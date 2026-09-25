import { expect } from 'chai';
import hardhat from 'hardhat';
import { ethers as ethersPkg } from 'ethers';

const { ethers } = hardhat;

function formatBytes32String(value: string): string {
  const bytes = ethersPkg.toUtf8Bytes(value);
  if (bytes.length > 32) {
    throw new Error('bytes32 string must be 32 bytes or fewer');
  }
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return ethersPkg.hexlify(padded);
}

describe('LegalVault', function () {
  it('deploys successfully', async function () {
    const [owner] = await ethers.getSigners();
    const LegalVault = await ethers.getContractFactory('LegalVault');
    const legalVault = await LegalVault.deploy();
    await legalVault.waitForDeployment();

    expect(legalVault.target).to.properAddress;
    expect(await legalVault.owner()).to.equal(owner.address);
  });

  it('anchors a document successfully', async function () {
    const [owner] = await ethers.getSigners();
    const LegalVault = await ethers.getContractFactory('LegalVault');
    const legalVault = await LegalVault.deploy();
    await legalVault.waitForDeployment();

    const documentHash = ethersPkg.keccak256(ethersPkg.toUtf8Bytes('document-data'));
    const referenceId = formatBytes32String('LV-DEMO-001');
    const eventType = 'EVIDENCE_UPLOAD';

    const tx = await legalVault.anchorDocument(documentHash, referenceId, eventType);
    const receipt = await tx.wait();

    expect(receipt.status).to.equal(1);
    expect(receipt.logs.length).to.be.greaterThan(0);

    const events = receipt.logs
      .map((log) => {
        try {
          return legalVault.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((parsed) => parsed && parsed.name === 'DocumentAnchored');

    expect(events.length).to.equal(1);
    const event = events[0];
    expect(event).to.not.be.null;
    expect(event?.args.documentHash).to.equal(documentHash);
    expect(event?.args.referenceId).to.equal(referenceId);
    expect(event?.args.actor).to.equal(owner.address);
    expect(event?.args.eventType).to.equal(eventType);

    const anchor = await legalVault.verifyDocument(documentHash);
    expect(anchor[0]).to.equal(true);
    expect(anchor[1]).to.equal(referenceId);
    expect(anchor[2]).to.equal(owner.address);
    expect(anchor[3]).to.equal(eventType);
    expect(BigInt(anchor[4])).to.be.greaterThan(0n);
  });

  it('rejects duplicate anchoring', async function () {
    const LegalVault = await ethers.getContractFactory('LegalVault');
    const legalVault = await LegalVault.deploy();
    await legalVault.waitForDeployment();

    const documentHash = ethersPkg.keccak256(ethersPkg.toUtf8Bytes('duplicate-document'));
    const referenceId = formatBytes32String('LV-DEMO-002');
    const eventType = 'VERSION_UPDATE';

    await legalVault.anchorDocument(documentHash, referenceId, eventType);
    await expect(legalVault.anchorDocument(documentHash, referenceId, eventType))
      .to.be.revertedWithCustomError(legalVault, 'DocumentAlreadyAnchored')
      .withArgs(documentHash);
  });

  it('rejects unauthorized anchoring', async function () {
    const [owner, unauthorized] = await ethers.getSigners();
    const LegalVault = await ethers.getContractFactory('LegalVault');
    const legalVault = await LegalVault.deploy();
    await legalVault.waitForDeployment();

    const documentHash = ethersPkg.keccak256(ethersPkg.toUtf8Bytes('unauthorized-doc'));
    const referenceId = formatBytes32String('LV-DEMO-003');
    const eventType = 'EVIDENCE_UPLOAD';

    await expect(
      legalVault.connect(unauthorized).anchorDocument(documentHash, referenceId, eventType),
    )
      .to.be.revertedWithCustomError(legalVault, 'UnauthorizedAnchor')
      .withArgs(unauthorized.address);
  });
});
