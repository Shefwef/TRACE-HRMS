/**
 * Seeds DailyScrumEntry + DailyTask rows for Sept 27-30, 2026 (Sun-Wed)
 * from the printed Daily Check-In sheets shared by HR.
 *
 *   npx tsx --env-file=.env.local scripts/seed-daily-scrum.ts                       (dry-run)
 *   npx tsx --env-file=.env.local scripts/seed-daily-scrum.ts --apply               (writes)
 *   npx tsx --env-file=.env.local scripts/seed-daily-scrum.ts --reset --apply       (wipe + reseed)
 *
 * Idempotent when run without --reset: skips a (date, employee) that
 * already has an entry, and skips a task whose text is already present.
 * With --reset every DailyScrumEntry (and its tasks) is deleted first so
 * the board reflects only the PDF content.
 *
 * Task status is derived from the text — anything containing "(done)"
 * (case-insensitive) is DONE; everything else is IN_PROGRESS. Priority
 * is randomized deterministically per task (30% HIGH / 40% MEDIUM /
 * 30% LOW) and tasks within each column are ordered HIGH → LOW so the
 * highest-priority items sit at the top.
 *
 * COMPLETED-type tasks (the "Yesterday/Completed" column) get status =
 * DONE regardless of the "(done)" marker — that column semantically
 * means "already finished". TODAY-type tasks get IN_PROGRESS unless
 * the text explicitly says "(done)" (which happens when the writer
 * ticked something off during the day).
 */
import { PrismaClient } from '@prisma/client';
import type { DailyTaskType, DailyTaskStatus, DailyTaskPriority } from '@prisma/client';

const prisma = new PrismaClient();

/** PDF names → DB canonical names. */
const NAME_ALIAS: Record<string, string> = {
  'ASM Saifullah':            'Abu Saleh Muhammad Saifullah',
  'Recardo SA Halder':        'Recardo Saurav Antor Halder',
  'Shefayat E Shams Adib':    'Shefayat E Shams',
  'Mahamudul Hasan':          'Md Mahamudul Hasan',
  'Muftehedul Islam Mithul':  'Md. Muftehedul Islam Mithul',
};

interface EntrySeed {
  personPdfName: string;
  completed: string[];
  today: string[];
}

interface DaySeed {
  date: string; // YYYY-MM-DD
  entries: EntrySeed[];
}

// ─── Sept 27 (Sunday) ───────────────────────────────────────────────
const SUN_27: DaySeed = {
  date: '2026-09-27',
  entries: [
    {
      personPdfName: 'ASM Saifullah',
      completed: [
        'Interview: Admin & Finance Executive (Done)',
        'Review and provide inputs in vendor list and other SOPs for ISO Audit (Continued)',
        'Follow up with Fishtech to confirm gap assessment visit plan (Confirmed visit of Mahmud vai)',
        'Overtime mechanism for support staff (Finalized)',
      ],
      today: [
        'Cash withdrawal for BRCP event',
        'Contact Startech and order attendance device cards which will be printed as employee ID cards',
        'Review Recruitment SOP',
      ],
    },
    {
      personPdfName: 'Mimma Afrin',
      completed: [
        'Prepared Visitor record form and confidentiality agreement form',
        'Prepared Risk Register and supplier evaluation procedure',
        'Follow up with Fahmida Apu to discuss the recruitment SOP, related forms and add document number for traceability',
        'Create & organize Microsoft Teams folders for document segregation',
      ],
      today: [
        'Update Clause 5 & 6 documents as per requirements of Quality manual',
        'Organize Microsoft Teams document and share',
        "Coordinate with Mahmud vai's Gap Assessment visit findings",
        'Finalize Bitid lab visit plan with expert',
        'Follow up KIMIA for PT sample dispatch',
      ],
    },
    {
      personPdfName: 'Nabeel Khan',
      completed: [
        'Finalize preparations for Inception Workshop',
        'Follow-up with BRCP-1 for final changes and edits to IR/P',
        'Coordinate follow-up with participants, tagging OBD along',
        'Prepare Cash-envelop for Honorarium. Confirm Hon amount',
        'Review the updated PPT for IW',
        'Finalize the Internal Agreement with OBD',
        'Finalize the Video Script',
        'SD-5 support research',
      ],
      today: [
        'Conduct Final Check for IRW preparation',
        'Follow-up with invitees',
        'Share the PPT with the invitees over WhatsApp/eMail',
        'Oversee DLA document',
        'Cross-check PPT with BRCP-1',
        'Check Venue preparedness',
      ],
    },
    {
      personPdfName: 'Recardo SA Halder',
      completed: [
        'Tax docs (BTF) - 2 remaining (Contd)',
        'Final logistics - planning - SD 59',
        'Payment disbursement and others if required (done)',
        'Mimma apa - SOP - Project management (contd)',
        'David Lupton Documentation (contd)',
        'Purchase of notebook and pen (not done)',
        'Advance payment to CIRDAP (done)',
        'Send documents to TTT (POA, TECH 7, TECH 8)',
      ],
      today: [
        'Manage all logistics related to workshop',
        'Confirm with venue',
        'Cash required (honorium)',
        'Banner Printing',
        'Mimma apa - SOP - Project management',
        'Attendance Sheet print',
        'Buying Envelope, Pen, Folder, notebook',
        'Send Docs to DLA',
      ],
    },
    {
      personPdfName: 'Moudud Ahmmed Sujan',
      completed: [
        'Web Content Script and shooting plan finalise (cont)',
        'Ministry gift supply (follow up)',
        'Climate fund explore',
      ],
      today: [
        'Handover Ministry Gift (follow up)',
        'Probashi Article',
        'Web Content Script and shooting plan finalise',
      ],
    },
    {
      personPdfName: 'Rubayat E Shams Anik',
      completed: [
        'SD-59 Inception Meeting Presentation (if any updates)',
        'Inception Meeting Tasks: Banner Design update',
        'SD-59 Agreement Review',
        'Website image, Social Media Post, Caption (New Project with Fishtech)',
        'Job ID and Letterhead update',
      ],
      today: [
        'Inception Workshop Related Pre-event tasks (Arrange the attendance sheet, honorium sheet, agenda, powerpoint, send out for print)',
        'SD-59 Presentation Update (for Inception)',
      ],
    },
    {
      personPdfName: 'Ahmed Julker Nine',
      completed: [
        'Communicate with Swarna Apu for information related to Import trend and volume',
        'Co-ordination with Loap Apu for Presentation Finalization',
        'Cross check the list of food items with IPO Annex-4',
        'AHCAB SRO development and Identification of Counterfeit Products (Plan and discussion with Shamrat sir and Fuad Sir)',
      ],
      today: [
        'Follow up with the participants of SD-59; Inception report finalization program',
        'SD-59 ppt finalization meeting and support',
      ],
    },
    {
      personPdfName: 'Tahsina Shiva',
      completed: [
        "Prepare the organization's IT protocol SOP with Mimma apa (draft)",
        'TRACE website CMS update (fishtech project)',
        'HRMS system QA of the developed features and feedback',
        'Work order send to Bergertech for microsoft license',
        'Mockup UI design of Reporting page, documentation, activity log (HRMS) (not completed yet)',
      ],
      today: [
        'Mockup UI design of Reporting page, documentation, activity log (HRMS)',
        'Sit with Mimma apa & Saifullah bhai regarding documentation format',
        'List down tasks for Mithul bhai',
        'TRACE CMS update (if requires)',
      ],
    },
    {
      personPdfName: 'Fahmida Akter',
      completed: [
        'Offer letter generating for Riya Biswas (Research Intern)',
        'Letter Head Design Finalization (Anik Bhai)',
        'Preparing a overtime payment mechanism for office support staffs',
        'Job post on LinkedIn - Graphics Designer',
        'Rejection Mail to Rafia & Muttaky (Visual Communication Intern), Shawon Gazi (Research Intern)',
        'Assessment test scheduling (Lab Quality Management Intern)',
        'Reference check for Mahamudul (Research Intern)',
        'Accounts & Finance Interview coordination',
        'Referee information request - Himadri Shekhar Ganguly (Accounts & Finance Executive)',
      ],
      today: [
        'Offer letter generating for Mahamudul (Research Intern)',
        'ID Card Design Finalization (Dependency Anik Bhai, Fuad Bhai)',
        'New letter head circulation',
        'Preparing service agreement for Laptop vendor',
        'Reimbursement & car requisition instructions sending to employees',
        'Missing documents collection from employees',
        'Sending signed agreement to Aamra Pro',
        'CV sorting for Social Media Manager & Graphics Designer (Assistance needed from Julker Bhai)',
        'Reference check for Naved Afnan (Research Intern)',
        'Reference Check for Himadri Shekhar Ganguly (Accounts & Finance Executive)',
      ],
    },
    {
      personPdfName: 'Shefayat E Shams Adib',
      completed: [
        "Discussed with Shiva apu on today's implementation and organized our priorities for different feature implementation of HRMS",
        'Updated the logic and implementation of the leave requester form and the table schema',
        'Updated different functionalities related to attendance and updated the attendance table schema as well',
        'Updated the logic and implementation of the individual profile page that is accessible from the admin panel',
        "Updated the form from the approver/rejecter's POV and connected the updated logic to the existing system's components",
        'Performed QA and bug fixing on the implemented modules',
        'Took feedback and discussed with Shiva apu on further implementations of new features',
      ],
      today: [
        'Discuss and finalize the logic on the new features',
        'Implement the new features and connect with the existing modules',
        'Fix bugs and perform QA on the implemented features',
      ],
    },
    {
      personPdfName: 'Mahanaz Akter Lopa',
      completed: [
        'Attend the workshop on safe food guidelines at BFSA office',
        'Participated in phone followup for the seminar on inception report',
      ],
      today: [
        "Will follow up again to get participants' confirmation status regarding the workshop on Inception Report",
        'Review the Inception report of E-learning platform',
        'Meeting on SD-59 event PPT review',
      ],
    },
  ],
};

// ─── Sept 28 (Monday) ────────────────────────────────────────────────
const MON_28: DaySeed = {
  date: '2026-09-28',
  entries: [
    {
      personPdfName: 'ASM Saifullah',
      completed: [
        'Cash withdrawal for BRCP event (Done)',
        'Contact Startech and order attendance device cards which will be printed as employee ID cards (Need consultation with Shiva apa)',
        'Review Recruitment SOP (Done)',
        'Coordinate with BITID lab on logistics for Accreditation Experts (Done)',
        'Follow up with Malaysian lab on PT sample despatch date (emailed and waiting for response)',
      ],
      today: [
        'Procure Office Chair',
        'Coordinate with SGS Auditors and ensure logistics for Audit on 30 Sept',
        'Negotiate with vendor and ensure delivery of three laptops by 30 Sept',
        'Review ISO documents',
        'Contribute to organize documents on Teams and Sharepoint',
        'Meeting with Accreditation expert to explore potential for collaboration',
      ],
    },
    {
      personPdfName: 'Mimma Afrin',
      completed: [
        'Update Clause 5 & 6 documents as per requirements of Quality manual',
        'Organize Microsoft Teams document and share',
        "Coordinate with Mahmud vai's Gap Assessment visit findings",
        'Finalize Bitid lab visit plan with expert (Meeting)',
        'Follow up KIMIA for PT sample dispatch',
      ],
      today: [
        'Update Clause 6 & 7 documents as per requirements of Quality manual',
        'Organize Microsoft Teams document and share',
        'Meeting with Accreditation expert',
        'Schedule plan and create checklist for BITID lab',
        'Search PT schedule for Fishtech lab',
      ],
    },
    {
      personPdfName: 'Nabeel Khan',
      completed: [
        'Conduct Final Check for IRW preparation',
        'Follow-up with invitees',
        'Share the PPT with the invitees over WhatsApp/eMail',
        'Oversee DLA document',
        'Cross-check PPT with BRCP-1',
        'Check Venue preparedness',
      ],
      today: [
        'BRCP-1 SD 59 IWM coordination and management',
        'Oversee follow-up with invitees',
        'Engage with BRCP-1 team for even coordination',
      ],
    },
    {
      personPdfName: 'Recardo SA Halder',
      completed: [
        'Manage all logistics related to workshop - Half done',
        'Confirm with venue - Done',
        'Cash required (honorium) - Done',
        'Banner Printing - Half-done',
        'Mimma apa - SOP - Project management (Contd)',
        'Attendance Sheet print - Done',
        'Buying Envelope, Pen, Folder, notebook - Done',
        'Send Docs to DLA - Done',
      ],
      today: [
        'BRCP event coordination and management',
      ],
    },
    {
      personPdfName: 'Moudud Ahmmed Sujan',
      completed: ['Probashi Article'],
      today: [
        'Handover Ministry Gift (follow up)',
        'YouTube Content Script and shooting plan',
        'GIET bank account follow up',
      ],
    },
    {
      personPdfName: 'Rubayat E Shams Anik',
      completed: [
        'Inception Workshop Related Pre-event tasks (Arrange the attendance sheet, honorium sheet, agenda, powerpoint, send out for print)',
        'SD-59 Presentation Update (for Inception)',
      ],
      today: ['Inception Workshop SD59 - eLearning'],
    },
    {
      personPdfName: 'Ahmed Julker Nine',
      completed: [
        'Follow up with the participants of SD-59; Inception report finalization program',
        'SD-59 ppt finalization meeting and support',
      ],
      today: [
        'Follow up with some participants for confirmation and nominee information',
        'Send out SD-59 related documents to the participants of the event',
        'Taking meeting notes for minutes of the SD-59 event',
      ],
    },
    {
      personPdfName: 'Tahsina Shiva',
      completed: [
        'Mockup UI design of Check in meeting page (HRMS), QA & feedback',
        'Sit with Mimma apa & Saifullah bhai regarding documentation format (preferably tomorrow)',
        'List down tasks for Mithul bhai (cont)',
        'TRACE CMS update (bfsa event)',
      ],
      today: [
        'Mockup UI design for Reporting page',
        'List down tasks for FSD (cont)',
        'TRACE CMS update - Organize insights',
        'Discuss with Shefayat regarding the new feature implementation',
      ],
    },
    {
      personPdfName: 'Fahmida Akter',
      completed: [
        'New letter head circulation',
        'Sending signed agreement to Aamra Pro',
        'Contract amendment draft',
        'Salary negotiation with Himadri',
        'Reference check for Naved Afnan (Research Intern)',
        'Reference Check for Himadri Shekhar Ganguly (Accounts & Finance Executive)',
      ],
      today: [
        'Offer letter generating for Mahamudul & Naved (Research Intern)',
        'ID Card Design Finalization (Dependency Anik Bhai, Fuad Bhai)',
        'Offer Letter Generating for Himadri (Assistant Manager - Accounts & Finance)',
        'Preparing service agreement for Laptop vendor',
        'Reimbursement & car requisition instructions sending to employees',
        'Missing documents collection from employees',
        'CV sorting for Social Media Manager & Graphics Designer (Assistance needed from Julker Bhai)',
        'Participating BRCP event',
        'Contract Generation for Mithul',
        'Contract generation for Riya Biswas',
        'BRCP event attendance sheet preparation',
      ],
    },
    {
      personPdfName: 'Shefayat E Shams Adib',
      completed: [
        'Upon discussion with Shiva Apu fully implemented the Replacement Leave functionality',
        'Updated RBAC logic and updated the functionality accordingly',
        'Biometric Driven Replacement Leave automation done',
        "Redesigned the landing page and the sign in page's UI",
        "Migration of the Admin role's authorization to HR completed and deployed",
        'Schema change on the Replacement Leave table',
        "Approver/Rejector's form updated",
      ],
      today: [
        'Discuss and finalize the logic on the new features',
        'Implement the new features and connect with the existing modules',
        'Fix bugs and perform QA on the implemented features',
      ],
    },
    {
      personPdfName: 'Mahanaz Akter Lopa',
      completed: [
        "Completed follow up to get participants' confirmation status regarding the workshop on Inception Report",
        'Provided a short review to add in the Inception report of E-learning platform',
        'Participated in Meeting on SD-59 event PPT review',
        'Provided a brief agenda on inception workshop',
      ],
      today: [
        'Yet to receive response from 2 participants (Followup them)',
        'Read the documents related to TARAPS project',
      ],
    },
  ],
};

// ─── Sept 29 (Tuesday) ────────────────────────────────────────────────
const TUE_29: DaySeed = {
  date: '2026-09-29',
  entries: [
    {
      personPdfName: 'ASM Saifullah',
      completed: [
        'Procure Office Chair (Selected one but price is 17000 after discount)',
        'Coordinate with SGS Auditors and ensure logistics for Audit on 30 Sept (SGS yet to confirm the auditors names)',
        'Negotiate with vendor and ensure delivery of three laptops by 30 Sept (Done)',
        'Review ISO documents (Done)',
        'Contribute to organize documents on Teams and Sharepoint',
        'Meeting with Accreditation expert to explore potential for collaboration (Can pursue medical lab accreditation and trainings)',
      ],
      today: [
        'Follow up with laptop vendor',
        'Follow up with SGS',
        'Bank transactions',
        'Review ISO audit preparation',
      ],
    },
    {
      personPdfName: 'Mimma Afrin',
      completed: [
        'Update Clause 6 & 7 documents as per requirements of Quality manual',
        'Organize Microsoft Teams document and share',
        'Meeting with Accreditation expert',
        'Schedule plan and create checklist for BITID lab',
        'Search PT schedule & reference culture for Fishtech lab',
      ],
      today: [
        '30 Sept Audit related preparation and print (if required)',
        'Confirm Sirajum monira mam contract',
        'Seek assistance from recardo vai to rearrange project related files',
        'Coordinate with mahmud vai to finalize gap assessment report for fishtech lab',
      ],
    },
    {
      personPdfName: 'Nabeel Khan',
      completed: [
        'BRCP-1 SD 59 IWM management',
        'Oversaw final follow-up texting to participants',
        'Engage with BRCP-1 team for even coordination',
      ],
      today: [
        'Follow-up with Participants. Share Inception Report where not shared',
        'IRW de-brief, and post-event documentation',
        'Follow-up with BRCP-1 regarding topic finalization meeting',
        'Follow-up with OBD for next steps in project implementation',
      ],
    },
    {
      personPdfName: 'Recardo SA Halder',
      completed: ['BRCP event coordination and management'],
      today: [
        'Event related documentation for BRCP-1',
        'Reimbursement claims',
        'TRS preparation and planning - Samrat Sir',
        'Payment and other disbursements',
      ],
    },
    {
      personPdfName: 'Moudud Ahmmed Sujan',
      completed: [
        'Handover Ministry Gift (follow up) - done',
        'GIET bank account follow up - done',
      ],
      today: [
        "Handover Ministry Gift - sent to minister's house... (follow up)",
        'YouTube Content Script and shooting plan',
        'GIET bank account follow up (Cont)',
      ],
    },
    {
      personPdfName: 'Rubayat E Shams Anik',
      completed: ['Inception Workshop SD59 - eLearning'],
      today: [
        'SD-59 Agreement Update (Shared with Nabeel bhai)',
        'SD-59 Post Inception Meeting Discussion (Done)',
        'TARAPS Project Priorities listing (Planning Completed)',
        'CV formatting support to Mimma Apu for ISO',
        'Content Team Coordination (w/Tanvir Kabir bhai)',
        'Social Media Posting - (Inception SD-59, BFSA Meeting)',
        'ID card design finalization - Postponed to tomorrow',
        'Business Development Discussion (w/Fuad bhai)',
        'ToR filtering to identify BD opportunities (with Saifullah bhai, Julker bhai & Recardo bhai)',
        'Comms established with Genex (Tanvir Bhai)',
        'Visual Storyteller/Graphics Designer recruitment coordination (handed over CV and instructions to Fahmida apu)',
      ],
    },
    {
      personPdfName: 'Ahmed Julker Nine',
      completed: [
        'Follow up with some participants for confirmation and nominee information',
        'Send out SD-59 related documents to the participants of the event',
        'Taking meeting notes for minutes of the SD-59 event',
      ],
      today: [
        'CV update & sending to Mimma Apa',
        'Meeting Minutes of the SD-59; Inception Report Finalization Meeting',
        'SD-59; Inception Report Finalization Meeting; Debrief Meeting',
        'CV sorting (Graphic Designer & Social Media Manager)',
        'SD-59 website event preparing',
      ],
    },
    {
      personPdfName: 'Tahsina Shiva',
      completed: [
        'Mockup UI design for Reporting page',
        'List down tasks for FSD (cont)',
        'TRACE CMS update - Organized insights',
        'Discuss with Shefayat regarding the reporting module',
        'QA and Feedback',
      ],
      today: [
        'List down tasks for FSD (cont)',
        'TRACE CMS update - SD59 Event',
        'Requirement analysis with Shefayat regarding daily check in meeting module',
        'Preliminary discussion regarding documentation with Saifullah bhai, Fahmida and Mimma apa',
      ],
    },
    {
      personPdfName: 'Fahmida Akter',
      completed: [
        'Offer letter generating for Mahamudul (Research Intern)',
        'Reimbursement & car requisition instructions sending to employees',
        'Participating BRCP event',
      ],
      today: [
        'Offer letter generating for Naved (Research Intern)',
        'SharePoint Folder update',
        'Offer Letter Generating for Himadri (Assistant Manager - Accounts & Finance)',
        'Preparing service agreement for Laptop vendor',
        'Missing documents collection from employees',
        'CV sorting for Social Media Manager & Graphics Designer (Assistance needed from Julker Bhai)',
        'Contract Generation for Mithul',
        'Contract generation for Riya Biswas, Mahamudul',
        'Contract Amendments',
        'Referee Information Request - Monjurur Rahman Towfiq (Lab Quality Management Intern)',
        'Reviewing admin SOP (How to buy things, approval process)',
        'Debrief meeting minutes sharing',
      ],
    },
    {
      personPdfName: 'Shefayat E Shams Adib',
      completed: [
        'Synced with Shiva apu on the feedback mentioned and addressed them',
        "Replacement Leave Implementation's feedback addressed and QA - Bug Fixing done on those",
        "Different types of reports' excel and pdf export format finalized upon discussion with Shiva Apu",
        'Finalized the schema of each of the tables for the summaries those are to be exported',
        'Implemented the Reports section of the system',
        'Introduced different types of filtering mechanism on the report summaries',
        'Performed QA on the new implemented features',
        'Discussed with Shiva Apu on the new features that are to be integrated next day',
      ],
      today: [
        'Discuss with Shiva Apu the logic behind the integration of the Daily Tracker into the HRMS',
        'Finalize and implement different parts of the functionality',
        'Perform QA and fix bugs on the finished feature',
        'Discuss with Shiva Apu on finalizing the Daily Tracker implementation',
      ],
    },
    {
      personPdfName: 'Mahanaz Akter Lopa',
      completed: [
        'Yet to receive response from 2 participants (Done)',
        'Read the documents related to TARAPS project',
      ],
      today: [
        'Read the documents related to TARAPS project (Continue)',
        'Attend the debrief meeting on SD-59 Inception Workshop',
      ],
    },
  ],
};

// ─── Sept 30 (Wednesday) ──────────────────────────────────────────────
const WED_30: DaySeed = {
  date: '2026-09-30',
  entries: [
    {
      personPdfName: 'ASM Saifullah',
      completed: [
        'Follow up with laptop vendor (will supply two laptops and 4 mouse by 30 Sept)',
        'Follow up with SGS (Confirmed Auditor details)',
        'Bank transactions (Salary disbursed)',
        'Review ISO audit preparation (Done)',
      ],
      today: [
        'Pick up ISO Auditor from Baridhara DOHS',
        'Contribute to the ISO Audit process',
      ],
    },
    {
      personPdfName: 'Mimma Afrin',
      completed: [
        '30 Sept Audit related preparation and print (if required)',
        'Confirm Sirajum monira mam contract and share with saifullah vai',
        'Seek assistance from recardo vai to rearrange project related files (pending)',
        'Coordinate with mahmud vai to finalize gap assessment report for fishtech lab (Pending)',
      ],
      today: [
        'Facilitate auditor for stage-1 QMS audit',
        'Seek assistance from recardo vai to rearrange project related files in Teams',
        'Seat with fahmida apa regarding teams and sharepoint documents',
        'Seek travel approval for BITID lab visit with expert in chattogram (2 oct to 4 oct)',
      ],
    },
    {
      personPdfName: 'Nabeel Khan',
      completed: [
        'Follow-up with Participants. Share Inception Report where not shared',
        'IRW de-brief, and post-event documentation',
        'Follow-up with BRCP-1 regarding topic finalization meeting',
        'Follow-up with OBD for next steps in project implementation',
        'Youtube Video Script finalization',
      ],
      today: [
        'Follow-up for the Minutes of the Meeting to be shared with BRCP-1',
        'Review draft Inception Report',
        'Finalize time for meeting with Technical Committee on Thursday',
        'Demo content development for SRS workshop',
        'Internally finalize the course curriculum/topics for development',
        'Youtube video shooting plan',
      ],
    },
    {
      personPdfName: 'Recardo SA Halder',
      completed: [
        'Event related documentation for BRCP-1 (done)',
        'Reimbursement claims (done)',
        'TRS preparation and planning - Samrat Sir',
        'Payment and other disbursements (done)',
      ],
      today: [
        'TRS Inception report and implementation plan - Samrat Sir and Swarna apu',
        'Payment initiations (if any)',
        'Prepare TDS Payment Sheet - Participant Allowance - done',
        'Send Bills to Orange BD for Invoicing',
        'Update proposal tracker',
        'Send Akebul Vai tax docs - done',
        'Revise Attendance Sheet - SD 59 for documentation - done',
        'Return extra hand cash to Saifullah Vai/Fahmida - done',
        'Send requested personal data to Fahmida',
      ],
    },
    {
      personPdfName: 'Moudud Ahmmed Sujan',
      completed: [
        "Handover Ministry Gift - sent to minister's house... (follow up)",
        'YouTube Content Script and shooting plan',
        'GIET bank account follow up',
      ],
      today: [
        "Handover Ministry Gift - sent to minister's house... (follow up)",
        'YouTube Content Script and shooting plan',
        'GIET bank account follow up (Cont)',
      ],
    },
    {
      personPdfName: 'Rubayat E Shams Anik',
      completed: [
        'SD-59 Agreement Update (Shared with Nabeel bhai)',
        'SD-59 Post Inception Meeting Discussion (Done)',
        'TARAPS Project Priorities listing (Planning Completed)',
        'CV formatting support to Mimma Apu for ISO',
        'Content Team Coordination (w/Tanvir Kabir bhai)',
        'Social Media Posting - (Inception SD-59, BFSA Meeting)',
        'ID card design finalization - Postponed to tomorrow',
        'Business Development Discussion (w/Fuad bhai)',
        'ToR filtering to identify BD opportunities (with Saifullah bhai, Julker bhai & Recardo bhai)',
        'Comms established with Genex (Tanvir Bhai)',
        'Visual Storyteller/Graphics Designer recruitment coordination (handed over CV and instructions to Fahmida apu)',
      ],
      today: [
        'TARAPS Inception Report Drafting (with Mahanaz Apu)',
        'Learn regarding the FCDO meeting on (Technical Assistance Facility for Economic Governance Reforms in Bangladesh)',
        'Social Media Posting - (Inception SD-59, BFSA Meeting)',
        'Create Tracker for coordinating Proposal submission and Project implementation',
        'ID card design finalization',
        'Meeting with SD-59 Content Editing Team (Tanvir Kabir Bhai) with Nabeel bhai',
      ],
    },
    {
      personPdfName: 'Ahmed Julker Nine',
      completed: [
        'CV update & sending to Mimma Apa',
        'Meeting Minutes of the SD-59; Inception Report Finalization Meeting',
        'SD-59; Inception Report Finalization Meeting; Debrief Meeting',
        'CV sorting (Graphic Designer & Social Media Manager)',
        'SD-59 website event preparing',
        'Update Participant list as per the event',
      ],
      today: [
        'Meeting Minutes of the SD 59; Inception Report Finalization event',
        'Inception report send out to the participants',
        'Developing Counterfeit Product PPT',
        'TARAPS Project Priority listing (with Anik Bhai if Needed)',
        'CV Sorting (Graphic Designer & Social Media Manager)',
        'Reminder text send out to the participants for feedback on inception report (tomorrow)',
      ],
    },
    {
      personPdfName: 'Tahsina Shiva',
      completed: [
        'CV sorting - Social Media Manager (99)',
        'Requirement Analysis for Daily Tracker Module',
        'Insights organization with Mimma Apa',
        'Website post - SD-59',
        'List down Tasks for Mithul bhai',
      ],
      today: [
        'List down Tasks for Mithul bhai',
        'HRMS - overall QA & Feedback',
        'ISO Audit meeting',
        'CV sorting - social media manager',
      ],
    },
    {
      personPdfName: 'Fahmida Akter',
      completed: [
        'Offer letter generating for Naved (Research Intern)',
        'SharePoint Folder update',
        'Offer Letter Generating for Himadri (Assistant Manager - Accounts & Finance)',
        'Missing documents collection from employees',
        'CV sorting for Social Media Manager & Graphics Designer (Assistance needed from Julker Bhai, Shiva Apa) (Cont)',
        'Contract Generation for Mithul',
        'Referee Information Request - Monjurur Rahman Towfiq (Lab Quality Management Intern) (On hold)',
        'Debrief meeting minutes sharing',
      ],
      today: [
        'Preparing service agreement for Laptop vendor',
        'CV sorting for Social Media Manager & Graphics Designer (Assistance needed from Julker Bhai)',
        'Contract generation for Riya Biswas, Mahamudul, Naved',
        'Contract Amendments',
        'Rejection Mail to Lab Quality Management Interns',
        'Reviewing admin SOP (How to buy things, approval process)',
        'Rejection Mail to Admin & Finance Executive Candidates',
        'Sharepoint document organising',
        'Sitting arrangements for Naved, Mahamudul, Riya & Mithul',
        'Payment & reimbursement requests',
      ],
    },
    {
      personPdfName: 'Shefayat E Shams Adib',
      completed: [
        'Synced with Shiva Apu on the pending feedback for the Daily Scrum module and addressed each item',
        'Redesigned the Daily Scrum board (modal task form, wider layout, green checkmark states) to match the finalized mockup with Shiva Apu',
        'Merged the hero header, fixed the sticky header behavior, and rethemed section headers to the required color palette',
        "Refactored the tab lists - dropped redundant count and status columns based on Shiva Apu's feedback",
        'Redesigned the PDF export layouts for the Daily Scrum and Reports modules for cleaner leadership-facing output',
        'Renamed the sync button and improved its interaction feedback for clarity',
        'Consulted with Shiva Apu on remaining polish items and finalized the QA checklist for a full-system pass',
        'Performed QA and bug fixing on the modules touched today and deployed the updated build',
      ],
      today: [
        'Work through the remaining feedback items from Shiva Apu and address each one',
        'Perform full end-to-end QA across the entire HRMS (Attendance, Leave, Reports, Daily Scrum, Employee, Biometric sync)',
        'Fix any bugs surfaced during the system-wide QA pass',
        'Prepare the system for live deployment - finalize configs, verify data migrations, and confirm production readiness',
        'Sync with Shiva Apu on any final go-live checks before rollout',
      ],
    },
    {
      personPdfName: 'Mahanaz Akter Lopa',
      completed: [
        'Attended the debrief meeting on SD-59 Inception Workshop',
        'Prepare inception report for TARAPS project (Continue)',
        'Shared CV with Nimma apa',
      ],
      today: [
        'Prepare inception report on TARAPS with Anik bhai (Continue)',
        'Content Development Team Meeting with Nabeel bhai',
      ],
    },
  ],
};

// ─── Oct 1 (Thursday) ────────────────────────────────────────────────
const THU_01: DaySeed = {
  date: '2026-10-01',
  entries: [
    {
      personPdfName: 'ASM Saifullah',
      completed: [
        'Pick up ISO Auditor from Baridhara DOHS (Done)',
        'Contribute to the ISO Audit process (Done)',
      ],
      today: [
        'Review and finalize Counterfeit Product PPT',
        'Online meeting with Fishtech to share Gap Assessment findings',
        'Review updating documents on Teams and Sharepoint',
      ],
    },
    {
      personPdfName: 'Mimma Afrin',
      completed: [
        'Facilitate auditor for stage-1 QMS audit',
        'Rearrange lab and project related files in Teams (Continue)',
        'Seat with fahmida apa regarding teams and sharepoint documents (pending)',
        'Seek travel approval for BITID lab visit with expert in chattogram (2 oct to 4 oct)',
      ],
      today: [
        'Prepare Action plan for audit Findings',
        'Update Gap assessment report of Fishtech lab and share',
        'Meeting with Fishtech lab officials regarding assessment findings',
      ],
    },
    {
      personPdfName: 'Nabeel Khan',
      completed: [
        'Oversee sharing of Minutes of the Meeting to be shared with BRCP-1',
        'Reviewed draft Inception Report',
        'Requested time for meeting with Technical Committee: Scheduled for Monday',
        'Demo content development for SRS workshop: met with K-13',
        'Youtube video shooting plan',
        'Shared revised agreement with OrangeBD',
      ],
      today: [
        'Review draft Demo Module from K-13',
        'Follow-up with BRCP-1 for TC Meeting modalities',
        'Follow-up with OBD regarding agreement signing',
        'Prepare detailed task list and revise the detailed workplan',
        'Follow-up with IRW Participants for feedback on IR',
      ],
    },
    {
      personPdfName: 'Recardo SA Halder',
      completed: [
        'TRS Inception report and implementation plan - Samrat Sir and Swarna apu (not started)',
        'Payment initiations (car bill, Calude) - done',
        'Prepare TDS Payment Sheet - Participant Allowance - done',
        'Send Bills to Orange BD for Invoicing - done',
        'Update proposal tracker (contd)',
        'Send Akebul Vai tax docs - done',
        'Revise Attendance Sheet - SD 59 for documentation - done',
        'Return extra hand cash to Saifullah Vai / Fahmida - done',
        'Send requested personal data to Fahmida - done',
        'Bank beneficiary adding - Shiva, Sujan, Julker, Yasin',
      ],
      today: [
        'TRS Inception report and implementation plan - Samrat Sir and Swarna apu - done',
        'Update Proposal Tracker - contd',
        'Study TRS docs and literature review - contd',
        'Payment initiation (if any) - none required',
        'Venue booking for SRS workshop SD-59 - done',
      ],
    },
    {
      personPdfName: 'Rubayat E Shams Anik',
      completed: [
        'TARAPS Inception Report Drafting (with Mahanaz Apu)',
        'Learn regarding the FCDO meeting on (Technical Assistance Facility for Economic Governance Reforms in Bangladesh)',
        'Social Media Posting - (Inception SD-59, BFSA Meeting)',
        'Create Tracker for coordinating Proposal submission and Project implementation',
        'ID card design finalization',
        'Meeting with SD-59 Content Editing Team (Tanvir Kabir Bhai) with Nabeel bhai',
      ],
      today: [
        'TARAPS Inception Report Drafting (with Mahanaz Apu)',
        'Intern Onboarding',
        'Social Media Posting - (BFSA Meeting)',
        'Content Demo Development Coordination with Tanvir Bhai',
        'Sports Ministry Proposal Update & Followup',
        'Pursue LinkedIn verification (take docs from Saifullah bhai)',
        'Discussion on Counterfeit presentation',
        'Assigning tasks',
        'SM Post - Shiva Apu & Anik',
        'SM Post - FullStack Developer',
        'SM Post - Research Interns',
      ],
    },
    {
      personPdfName: 'Ahmed Julker Nine',
      completed: [
        'Meeting Minutes of the SD 59; Inception Report Finalization event',
        'Inception report send out to the participants',
        'Developing Counterfeit Product PPT',
        'TARAPS Project Priority listing (with Anik Bhai if Needed)',
        'CV Sorting (Graphic Designer & Social Media Manager)',
        'Reminder text send out to the participants for feedback on inception report (tomorrow)',
      ],
      today: [
        'Presentation Finalization for Paragon Group',
        'TARAPS Project Priority listing (with Anik Bhai if Needed)',
        'CV Sorting (Graphic Designer & Social Media Manager)',
        'Reminder text send out to the participants for feedback on inception report',
      ],
    },
    {
      personPdfName: 'Tahsina Shiva',
      completed: [
        'Prepared presentation ppt for senior FSD',
        'HRMS - overall QA & Feedback',
        'ISO Audit meeting',
        'CV sorting - social media manager',
        'Prepared Company ID of all TRACE employee',
      ],
      today: [
        'New Joinee Onboarding',
        'TRACE website update',
        'Sit with senior FSD - orientation, tasks assign and others',
        'SD-59 SRS review and feedback (if any)',
      ],
    },
    {
      personPdfName: 'Fahmida Akter',
      completed: [
        'Contract Amendments',
        'Rejection Mail to Lab Quality Management Interns',
        'Rejection Mail to Admin & Finance Executive Candidates',
        'Sharepoint document organising',
        'Sitting arrangements for Naved, Mahamudul, Riya & Mithul',
        'Payment & reimbursement requests',
        'Employment Agreement - Tabassum Sirajum Munira',
        'Asset acknowledgement form',
      ],
      today: [
        'Preparing service agreement for Laptop vendor',
        'CV sorting for Social Media Manager & Graphics Designer (Assistance needed from Julker Bhai)',
        'Contract generation for Riya Biswas, Mahamudul, Naved',
        'Asset Labeling to new laptops',
        'Welcoming new joineers',
        'Reviewing admin SOP (How to buy things, approval process)',
        'Replying to Aamra Pro & Zenorin',
        'Sharepoint document organising',
        'TRACE Orientation presentation review and update',
        'Payment & reimbursement requests',
        'Reference Check - Towfiq (Lab Quality Management Intern)',
      ],
    },
    {
      personPdfName: 'Shefayat E Shams Adib',
      completed: [
        'Worked through and addressed all feedback items raised by Shiva Apu on the Daily Tracker (Daily Scrum) module',
        'Updated the PDF format for Reports and report summaries based on the latest round of feedback',
        'Implemented the refreshed Homepage design and styling updates upon discussion with Shiva Apu',
        'Performed full thorough end-to-end QA across the entire HRMS and fixed bugs surfaced during the pass',
        'Deployed the updated build after clearing all QA-surfaced issues',
        'Synced with Shiva Apu on go-live readiness and consolidated pending action items into the pre-meeting checklist',
        "Finalized all pre-meeting deliverables for tomorrow's 3 PM meeting",
        'Prepared presentation materials and supporting documentation for the meeting',
        'Performed a dry-run walkthrough of the HRMS end-to-end with Shiva Apu to confirm demo readiness',
        'Completed remaining bug fixes surfaced during the dry-run walkthrough',
        'Synced with Shiva Apu on the meeting agenda and talking points for tomorrow',
      ],
      today: [
        'Complete final file preparations for the 3 PM meeting',
        'Rehearse the presentation walkthrough with Shiva Apu one final time before the meeting',
        'Attend and present in the 3 PM meeting',
        'Capture all feedback and action items raised during the meeting',
        'Work on the feedback raised in the meeting upon discussion with Shiva Apu',
        'Perform Performance QA on the system',
        'Deploy post-meeting fixes and update the plan accordingly',
      ],
    },
    {
      personPdfName: 'Mahanaz Akter Lopa',
      completed: [
        'Attended Content Development Team Meeting with Anik and Nabeel bhai',
        'Prepared a demo for content part of e-learning module 1',
        'Attended a meeting with Fuad Sir',
        'Prepare inception report on TARAPS with Anik bhai',
      ],
      today: [
        'Will try to complete the first version of inception report on TARAPS',
        'May need to work on e-learning module based on feedback from Tanvir bhai',
        'Team meeting with Fuad sir (11:00 am)',
      ],
    },
    {
      personPdfName: 'Mahamudul Hasan',
      completed: [],
      today: [
        'Set up email',
        'Set up Microsoft 365 (including cloud)',
        'Get your fingerprints registered on the punch machine',
        'Write a short bio for website',
        'Get added to TRACE whatsapp group',
        'Update your linkedin bio by the end of the day',
        'Add signature in the outlook',
      ],
    },
    {
      personPdfName: 'Naved Afnan',
      completed: [],
      today: [
        'Set up email',
        'Set up Microsoft 365 (including cloud)',
        'Get your fingerprints registered on the punch machine',
        'Write a short bio for website',
        'Get added to TRACE whatsapp group',
        'Update your linkedin bio by the end of the day',
        'Add signature in the outlook',
      ],
    },
  ],
};

// ─── Oct 4 (Sunday) ──────────────────────────────────────────────────
const SUN_04: DaySeed = {
  date: '2026-10-04',
  entries: [
    {
      personPdfName: 'ASM Saifullah',
      completed: [
        'Review and finalize Counterfeit Product PPT (Reviewed and Finalized by Fuad vai)',
        'Online meeting with Fishtech to share Gap Assessment findings (Explained findings and shared Action plan template)',
        'Review updating documents on Teams and Sharepoint (Reviewed and Updated)',
        'Consulted Mr. Komal regarding VAT return submission',
      ],
      today: [
        'Update proposal/project tracker',
        'Work with Mr. Komal and Recardo vai to submit VAT return',
        'Coordinate with Genex on existing tender opportunities',
      ],
    },
    {
      personPdfName: 'Nabeel Khan',
      completed: [
        'Follow-up with BRCP-1 for TC Meeting modalities',
        'Follow-up with OBD regarding agreement signing',
        'Follow-up with IRW Participants for feedback on IR',
        'Review SRS through T. Shiva',
        'Prepare detailed task list and revise the detailed workplan',
      ],
      today: [
        'Review Content List',
        'Follow-up with BRCP-1 for TC Meeting modalities',
        'Share draft Demo Module with internal team',
        'Finalize Module Structure for Demo, define scope',
      ],
    },
    {
      personPdfName: 'Recardo SA Halder',
      completed: [
        'TRS Inception report and implementation plan - Samrat Sir and Swarna apu - done',
        'Update Proposal Tracker - contd',
        'Study TRS docs and literature review - contd',
        'Payment initiation (if any) - none required',
        'Venue booking for SRS workshop SD-59 - done',
      ],
      today: [
        'SD-59 SRS workshop logistical plan',
        'SRS workshop budget estimation',
        'Reimbursement payments',
        'Disbursing venue rent to BFTI',
        'Manage logistics for the workshop',
      ],
    },
    {
      personPdfName: 'Rubayat E Shams Anik',
      completed: [],
      today: [
        'TARAPS Inception Report Drafting (with Mahanaz Apu)',
        'Intern Onboarding',
        'Social Media Posting - (BFSA Meeting)',
        'Content Demo Development Coordination with Tanvir Bhai',
        'Sports Ministry Proposal Update & Followup',
        'Pursue LinkedIn verification (take docs from Saifullah bhai)',
        'Discussion on Counterfeit presentation',
        'Assigning tasks',
        'SM Post - Shiva Apu & Anik',
        'SM Post - FullStack Developer',
        'SM Post - Research Interns',
      ],
    },
    {
      personPdfName: 'Ahmed Julker Nine',
      completed: [
        'Presentation Finalization for Paragon Group',
        'TARAPS Project Priority listing (with Anik Bhai if Needed)',
        'CV Sorting (Graphic Designer & Social Media Manager)',
        'Reminder text send out to the participants for feedback on inception report',
      ],
      today: [
        'TARAPS Project Priority listing (with Anik Bhai if Needed)',
        'CV Sorting (Graphic Designer & Social Media Manager)',
      ],
    },
    {
      personPdfName: 'Tahsina Shiva',
      completed: [
        'BRCP-59 SRS study and minor feedback (dependency on feedback from BRCP)',
        'New joinee onboarding formalities',
        'TRACE CMS update',
        'Orientation session with Mithul bhai',
        'Coordinate with OBD regarding tech doc',
        'HRMS feat QA',
      ],
      today: [
        'BRCP-59 SRS related tasks with relevant people',
        'HRMS system demonstration and feedback collection',
        'Sit with Fuad bhai & Mithul bhai regarding the Handover process planning',
        'Server specification finalization with mithul bhai',
        'TRACE CMS update',
        'CV sorting for social media manager & GD',
      ],
    },
    {
      personPdfName: 'Fahmida Akter',
      completed: [
        'Contract generation for Riya Biswas, Mahamudul, Naved',
        'Asset Labeling to new laptops',
        'Welcoming new joineers',
        'Replying to Zenorin',
        'Sharepoint document organising',
        'Reference Check - Towfiq (Lab Quality Management Intern)',
      ],
      today: [
        'Preparing service agreement for Laptop vendor',
        'CV sorting for Social Media Manager & Graphics Designer (Assistance needed from Julker Bhai)',
        'Asset Labeling to assets',
        'Reviewing admin SOP (How to buy things, approval process)',
        'Replying to Aamra Pro',
        'Sharepoint document organising',
        'TRACE Orientation presentation review and update',
        'Payment & reimbursement requests',
      ],
    },
    {
      personPdfName: 'Shefayat E Shams Adib',
      completed: [
        'Received update that the 3 PM meeting was postponed to next Sunday and realigned the day\'s priorities accordingly',
        'Completed the new role integration into the HRMS (schema, permissions, access controls, and UI flows)',
        'Performed QA on the new role integration and verified access controls across all modules',
        'Addressed pending feedback items from Shiva Apu',
        'Started the performance optimization pass across the system and identified key bottlenecks',
        'Resolved the top-priority performance bottlenecks and verified improvements across modules',
        'Deployed the updated build after clearing QA-surfaced issues from the new role integration',
        'Performed cross-module QA with the new role in place',
        "Consulted with Shiva Apu on the revised plan ahead of next Sunday's meeting",
        'Prepared the working checklist for the landing page revamping',
      ],
      today: [
        'Start the landing page revamp - implement the refreshed layout, hero section, and overall visuals',
        'Work through the remaining feedback items from Shiva Apu on the system',
        'Continue Performance QA across the system and address any remaining bottlenecks',
        'Perform full end-to-end QA including the new landing page',
        'Fix any bugs surfaced during the QA pass',
        'Sync with Shiva Apu on the landing page review and refine based on feedback',
        "Prepare the latest stable build and demo materials ahead of Sunday's meeting",
      ],
    },
    {
      personPdfName: 'Mahanaz Akter Lopa',
      completed: [
        'Completed around 80% the first version of inception report on TARAPS',
        'Had a short meeting with Anik bhai on TARAPS',
      ],
      today: [
        'Complete the first version of TARAPS with Anik bhai',
        'Will show the first version of TARAPS to Fuad sir',
        'Need to sign up and go through a ITC course for e-learning module',
      ],
    },
    {
      personPdfName: 'Muftehedul Islam Mithul',
      completed: [
        'Joining and Introduction',
        'Take orientation from shiva apu',
        'Getting access to necessary accounts',
        'Computer file backup',
      ],
      today: [
        'Ubuntu installation and development environment setup',
        'Attendance machine integration R&D',
        'Planning for server and website migration plan',
      ],
    },
  ],
};

const ALL_DAYS: DaySeed[] = [SUN_27, MON_28, TUE_29, WED_30, THU_01, SUN_04];

// ─── Runner ──────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<DailyTaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// Deterministic hash so re-runs pick the same "random" priority per task.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 30% HIGH / 40% MEDIUM / 30% LOW.
function priorityFor(seed: string): DailyTaskPriority {
  const roll = hashString(seed) % 10;
  if (roll < 3) return 'HIGH';
  if (roll < 7) return 'MEDIUM';
  return 'LOW';
}

function statusFor(text: string, type: DailyTaskType): DailyTaskStatus {
  if (type === 'COMPLETED') return 'DONE';
  // COMPLETED-column items are historically done; TODAY items default to
  // IN_PROGRESS unless the writer explicitly ticked one off inline.
  const normalized = text.toLowerCase();
  return normalized.includes('(done)') ? 'DONE' : 'IN_PROGRESS';
}

function canonicalName(pdfName: string): string {
  return NAME_ALIAS[pdfName] ?? pdfName;
}

async function findEmployeeId(pdfName: string): Promise<string | null> {
  const canonical = canonicalName(pdfName);
  // Prefer active, non-deleted users. If duplicates exist (e.g. a deleted
  // old account with the same name), the active one wins.
  const user = await prisma.user.findFirst({
    where: { fullName: { equals: canonical, mode: 'insensitive' }, deletedAt: null },
    select: { id: true, isActive: true },
    orderBy: [{ isActive: 'desc' }, { employeeIdCode: 'asc' }],
  });
  return user?.id ?? null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const reset = process.argv.includes('--reset');
  console.log(apply ? '=== APPLYING ===' : '=== DRY-RUN (add --apply to write) ===');
  if (reset) console.log('=== --reset: existing DailyScrumEntry rows will be wiped ===');

  if (reset && apply) {
    const tasksDel = await prisma.dailyTask.deleteMany({});
    const entriesDel = await prisma.dailyScrumEntry.deleteMany({});
    console.log(`Deleted ${tasksDel.count} tasks and ${entriesDel.count} entries.\n`);
  } else if (reset && !apply) {
    const tasksCount = await prisma.dailyTask.count();
    const entriesCount = await prisma.dailyScrumEntry.count();
    console.log(`Would delete ${tasksCount} tasks and ${entriesCount} entries.\n`);
  }

  let daysProcessed = 0;
  let entriesCreated = 0;
  let entriesSkipped = 0;
  let tasksInserted = 0;
  let tasksSkipped = 0;
  const missingPeople = new Set<string>();

  for (const day of ALL_DAYS) {
    daysProcessed += 1;
    const dateOnly = new Date(day.date + 'T00:00:00Z');
    console.log(`\n[${day.date}]`);

    for (const entry of day.entries) {
      const employeeId = await findEmployeeId(entry.personPdfName);
      if (!employeeId) {
        missingPeople.add(entry.personPdfName);
        console.log(`  SKIP     ${entry.personPdfName.padEnd(24)} (not found in users)`);
        continue;
      }

      const existing = await prisma.dailyScrumEntry.findUnique({
        where: { date_employeeId: { date: dateOnly, employeeId } },
        include: { tasks: { select: { text: true } } },
      });

      let scrumEntryId: string;
      if (existing) {
        entriesSkipped += 1;
        scrumEntryId = existing.id;
        console.log(`  EXISTS   ${entry.personPdfName.padEnd(24)} entry ${existing.id.slice(0, 8)}...`);
      } else {
        if (apply) {
          const created = await prisma.dailyScrumEntry.create({
            data: { date: dateOnly, employeeId },
          });
          scrumEntryId = created.id;
        } else {
          scrumEntryId = '(pending)';
        }
        entriesCreated += 1;
        console.log(`  CREATE   ${entry.personPdfName.padEnd(24)} entry`);
      }

      const existingTexts = new Set(existing?.tasks.map((t) => t.text.toLowerCase()) ?? []);

      type Pending = {
        entryId: string;
        type: DailyTaskType;
        status: DailyTaskStatus;
        text: string;
        priority: DailyTaskPriority;
        order: number;
      };

      const collect = (texts: string[], type: DailyTaskType): Pending[] => {
        const rows: Pending[] = [];
        for (const text of texts) {
          if (existingTexts.has(text.toLowerCase())) { tasksSkipped += 1; continue; }
          rows.push({
            entryId: scrumEntryId,
            type,
            status: statusFor(text, type),
            text,
            priority: priorityFor(`${day.date}|${entry.personPdfName}|${type}|${text}`),
            order: 0,
          });
        }
        // HIGH first, then MEDIUM, then LOW. Stable within a bucket.
        rows.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
        rows.forEach((r, i) => { r.order = i; });
        return rows;
      };

      const toInsert: Pending[] = [
        ...collect(entry.completed, 'COMPLETED'),
        ...collect(entry.today, 'TODAY'),
      ];

      if (apply && toInsert.length > 0 && scrumEntryId !== '(pending)') {
        await prisma.dailyTask.createMany({
          data: toInsert.map((t) => ({
            entryId: t.entryId,
            type: t.type,
            status: t.status,
            text: t.text,
            order: t.order,
            priority: t.priority,
            isDecision: false,
            carryOver: false,
          })),
        });
      }
      tasksInserted += toInsert.length;
      console.log(`    ${toInsert.length} task${toInsert.length === 1 ? '' : 's'} to insert`);
    }
  }

  console.log('\n─── Summary ───');
  console.log(`Days processed:    ${daysProcessed}`);
  console.log(`Entries created:   ${entriesCreated}`);
  console.log(`Entries existed:   ${entriesSkipped}`);
  console.log(`Tasks inserted:    ${tasksInserted}`);
  console.log(`Tasks skipped:     ${tasksSkipped} (already on entry)`);
  if (missingPeople.size > 0) {
    console.log(`\nMissing users (need to be created + Trace-ID first):`);
    for (const p of missingPeople) console.log(`  - ${p}  (canonical: ${canonicalName(p)})`);
  }
  if (!apply) console.log('\nRun again with --apply to write (add --reset to wipe first).');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
