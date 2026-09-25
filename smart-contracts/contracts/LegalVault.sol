// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

contract LegalVault is Ownable {
    constructor() Ownable(msg.sender) {}

    struct Anchor {
        bytes32 documentHash;
        bytes32 referenceId;
        uint256 timestamp;
        address actor;
        string eventType;
    }

    mapping(bytes32 => Anchor) private anchors;
    mapping(bytes32 => bool) private anchored;
    mapping(address => bool) private authorizedAnchors;

    event DocumentAnchored(
        bytes32 indexed documentHash,
        bytes32 indexed referenceId,
        address indexed actor,
        string eventType,
        uint256 timestamp
    );

    event AuthorizedAnchorAdded(address indexed anchor);
    event AuthorizedAnchorRemoved(address indexed anchor);

    error DocumentAlreadyAnchored(bytes32 documentHash);
    error DocumentNotAnchored(bytes32 documentHash);
    error UnauthorizedAnchor(address anchor);

    modifier onlyAuthorizedAnchor() {
        if (!authorizedAnchors[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedAnchor(msg.sender);
        }
        _;
    }

    function anchorDocument(
        bytes32 documentHash,
        bytes32 referenceId,
        string calldata eventType
    ) external onlyAuthorizedAnchor {
        if (anchored[documentHash]) {
            revert DocumentAlreadyAnchored(documentHash);
        }

        anchors[documentHash] = Anchor({
            documentHash: documentHash,
            referenceId: referenceId,
            timestamp: block.timestamp,
            actor: msg.sender,
            eventType: eventType
        });
        anchored[documentHash] = true;

        emit DocumentAnchored(documentHash, referenceId, msg.sender, eventType, block.timestamp);
    }

    // Owner functions to manage authorized anchors
    function addAuthorizedAnchor(address anchor) external onlyOwner {
        authorizedAnchors[anchor] = true;
        emit AuthorizedAnchorAdded(anchor);
    }

    function removeAuthorizedAnchor(address anchor) external onlyOwner {
        authorizedAnchors[anchor] = false;
        emit AuthorizedAnchorRemoved(anchor);
    }

    function isAuthorizedAnchor(address anchor) external view returns (bool) {
        return authorizedAnchors[anchor] || anchor == owner();
    }

    function verifyDocument(bytes32 documentHash)
        external
        view
        returns (
            bool exists,
            bytes32 referenceId,
            address actor,
            string memory eventType,
            uint256 timestamp
        )
    {
        if (!anchored[documentHash]) {
            return (false, 0x0, address(0), '', 0);
        }

        Anchor storage anchor = anchors[documentHash];
        return (
            true,
            anchor.referenceId,
            anchor.actor,
            anchor.eventType,
            anchor.timestamp
        );
    }
}
