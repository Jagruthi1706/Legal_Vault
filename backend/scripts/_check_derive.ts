import { deriveLegalRetrievalQuery } from '../src/services/ai/ai.service';
const tests = ['Section 35A','Section 46A','Order I Rule 1','Order VIII Rule 1','Order VII Rule 11','Order XXXIX Rule 1','Section 9','Section 11','res judicata','temporary injunction','review of judgment','inherent powers'];
for (const q of tests) console.log(q + ' => ' + deriveLegalRetrievalQuery(q));

