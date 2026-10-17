'use strict';
// Requirement catalog from the Preventive Medicine promotion handbook (R1–R4) and the SCFHS 2026 curriculum.
const R={
course:[["Valid completion certificate in the resident's name, all modules completed",60],["Uploaded to portfolio with a 3–5 line reflection on how it applies to practice",30]],
cap:[["Paper choice: recent (≤5 years), peer-reviewed, relevant; PICO stated",10],["Correct appraisal checklist used; validity/bias assessed item by item",25],["Results interpreted correctly (effect size, 95% CI, NNT where relevant)",20],["Applicability to Saudi setting and practice discussed",15],["Presentation clarity and handling of discussion",20]],
cat:[["Structured PICO/PECO question",10],["Documented search: databases, terms, filters, hits",20],["Critical appraisal of the best 1–3 studies",20],["Level of evidence and synthesis across studies",15],["Clear bottom line and recommendation, with review date",15],["Format (1–2 pages, CAT template) and referencing",10]],
seminar:[["Content accurate and covers all required elements for the session type",30],["Current evidence and credible references",15],["Logical structure and clear visuals",15],["Delivery within time (20–30 min)",10],["Handling of questions",10],["Saudi relevance and elevator statement / key messages",10]],
cbd:[["Case selection and written pre-discussion summary",15],["Problem analysis and use of data",20],["Decision made and justification",25],["Use of evidence and guidelines",15],["Reflection and agreed action plan from feedback",15]],
minicex:[["Assessment / history / risk evaluation",20],["Communication and counseling",20],["Professionalism and ethics",15],["Clinical / preventive judgment",20],["Organization and efficiency",15]],
cot:[["Opening and rapport",15],["Exploring the person's concerns and expectations",20],["Explaining clearly and checking understanding",25],["Shared decision and safety-netting",20],["Closing and time management",10]],
logbook:[["All required entries completed for the year",40],["Every entry verified/signed by a supervisor",25],["Coverage of all rotations attended",15],["Accuracy and legibility of entries",10]],
iter:[["Average ITER rating across rotations (converted to %, ×0.7)",70],["All ITERs completed and approved in the system",20]],
portfolio:[["All evidence for the year present and current",35],["Quality of written reflections",30],["Organization and indexing",15],["Mentor review documented",10]],
volunteer:[["Hours achieved vs annual target of 10",60],["Evidence: letters or certificates",20],["Relevance to public health",10]],
hep:[["Problem and target group defined with data",15],["SMART objectives",10],["Behavioral theory/model applied",10],["Materials suitable for the audience's health literacy",15],["Actual implementation",20],["Evaluation (pre/post or process indicators)",15],["Final report with results",5]],
proposal:[["Background and clear gap",15],["Question (PICO) and objectives",10],["Search strategy and databases",25],["Eligibility, quality appraisal and synthesis plan",15],["Timeline and feasibility",10],["References and format",10],["Supervisor approval",5]],
ethics:[["Complete protocol (aims, design, sample size, analysis)",30],["Informed consent process and forms",15],["Data protection and confidentiality",15],["Risk–benefit assessment",10],["Proof of IRB submission or approval/exemption",20]],
review:[["Follows PRISMA (systematic) or SANRA (narrative)",25],["Quality of synthesis and discussion",25],["Scientific writing and language",15],["Journal is Web of Science-indexed and author guidelines followed",15],["Proof of submission (email / manuscript ID)",10]],
white:[["Problem statement and context",15],["Evidence summary",20],["Analysis of policy options (pros, cons, cost, feasibility)",25],["Clear recommendation",15],["Written for decision-makers (≤4 pages, executive summary)",15]],
program:[["Needs assessment and priority setting",15],["Logic model",15],["SMART objectives with indicators",15],["Evidence-based interventions",15],["Evaluation plan (process, outcome, impact)",20],["Budget and timeline",10]],
peer:[["Accurate summary of the manuscript",10],["Major comments: specific and numbered",25],["Minor comments",10],["Assessment of methods, statistics and ethics",25],["Recommendation justified",10],["Constructive, professional tone",10]],
ic:[["Setting and problem description",10],["Surveillance data with standard (NHSN) definitions",25],["Correct rate calculations",15],["Root-cause analysis",15],["Actionable recommendations with owner and date",20],["Report presentation",5]],
comm:[["Audience analysis",15],["Three key messages",20],["Channels, spokesperson, timing",15],["Applies CERC principles",10],["One-page media brief",20],["Reach and impact metrics",10]],
cna:[["Community defined (geography, population)",10],["Demographic, epidemiologic and social data",20],["Community voice (interviews, survey, focus groups)",15],["Mapping of services and assets",10],["Explicit prioritization method (e.g., Hanlon)",15],["Recommendations",15],["Presentation",5]],
outbreak:[["Outbreak verified; case definition",15],["Case finding",10],["Descriptive epidemiology (time, place, person; epi curve)",20],["Analytic study (OR/RR) testing a hypothesis",15],["Control measures",15],["Risk communication",5],["Final report",10]],
survrep:[["Data management and cleaning",15],["Analysis (trends, rates by age, sex, region)",25],["Tables and figures",15],["Interpretation",20],["Recommendations and executive summary",15]],
surveval:[["System description, purpose, data flow diagram",15],["Assessment of the nine attributes",40],["Usefulness",10],["Recommendations",15],["Report quality",10]],
poster:[["Scientific content",30],["Design and readability",20],["Results visuals",20],["Presentation at the event",20]],
present:[["Scientific content",30],["Delivery",20],["Slides",15],["Answers to questions",15],["Acceptance letter or certificate",10]],
original:[["Follows reporting guideline (STROBE/CONSORT etc.)",20],["Methodological rigor",25],["Analysis and results",20],["Discussion and limitations",15],["Proof of submission/acceptance to WoS/ISI journal",10]],
milestone:[["Milestone fully achieved",50],["Quality and data integrity",25],["Supervisor sign-off",15]],
exam:[["Exam score (converted to %, ×0.8)",80],["Written improvement plan after feedback",10]],
ebm:[["Structured question",10],["Systematic search documented",20],["Critical appraisal of evidence",25],["Translation into a clinical, preventive or policy decision",25],["Supervisor approval and originality statement",10]]
};

/* ---------- Instructions per type ---------- */
const I={
course:["Register on the course website with your official email.","Complete every module and the final quiz/self-assessment.","Download the certificate in your full name as it appears in SCFHS records.","Upload it to your portfolio and write a 3–5 line reflection."],
cap:["Pick a recent paper from a peer-reviewed journal (check the AHD timetable for the category: therapy, diagnosis, prognosis, SR).","Write the PICO of the paper.","Appraise it with the matching checklist (CASP, JBI; CONSORT for RCTs, STROBE for observational, PRISMA for SRs).","Report the main result with effect size and 95% CI; compute NNT where relevant.","Discuss applicability in Saudi Arabia and give a two-line bottom line.","Present at Journal Club; get the evaluation form signed."],
cat:["Write a focused PICO/PECO question from a real case or public health problem.","Search at least two databases (PubMed + one more); record terms, filters and number of hits.","Choose the best 1–3 studies, highest level of evidence first.","Appraise each with a standard checklist; state the level of evidence (Oxford CEBM).","Write the bottom line and a practical recommendation, plus a date to revisit the topic.","Keep it to 1–2 pages; present it and get the form signed."],
seminar:["Agree on a topic with the supervisor from the AHD list (outbreak case study, public health lab, health program, health organization, well-known survey/RCT, hot topic, public health issue).","Cover the required elements for that type. Outbreak study: descriptive epidemiology, clinical picture, diagnosis and management, risk of importation to Saudi Arabia, prevention and control, press release or health message, elevator statement.","Use current references (WHO, CDC, MOH, peer-reviewed).","Rehearse to 20–30 minutes; prepare for questions.","Send slides to the supervisor one week before; get the form signed."],
cbd:["Pick a case or public health event you managed during the current rotation.","Prepare a one-page summary: problem, data, decision, evidence, alternatives.","Book 20–30 minutes with the assessor; discuss the reasoning.","Agree on an action plan; the assessor completes and signs the CBD form."],
minicex:["Arrange with an assessor in advance; choose a real encounter (preventive consultation, counseling, vaccination, screening).","Assessor observes 15–20 minutes without interrupting.","Receive 5–10 minutes of feedback immediately after.","Use different assessors and settings across the year; form signed the same day."],
cot:["Record or have an assessor observe a consultation (with patient consent).","Focus on communication: concerns, explanation, shared decision.","Review with the assessor using the COT form; agree on one improvement point."],
logbook:["Record activities as they happen, not at year end.","Get each entry signed by the supervising consultant.","Check that every rotation has entries; submit the completed logbook by the deadline."],
iter:["Remind the rotation supervisor two weeks before each rotation ends.","Check in the system that every ITER is completed and approved.","Discuss any low rating with the program director with an improvement plan."],
portfolio:["Keep one folder per year with sub-folders per requirement.","Add every certificate, form and report as soon as it is completed.","Write a short reflection (what happened, what I learned, what I will change) for major items.","Meet your mentor in January and July to review it."],
volunteer:["Target 10 hours per year (40 for the program).","Choose public health activities: campaigns, screening days, Hajj/Umrah health services, community events.","Obtain a letter or certificate stating hours; file it in the portfolio."],
hep:["Choose a health problem and target group using local data.","Write SMART objectives; choose a behavioral model (Health Belief Model, Transtheoretical, COM-B).","Develop materials at the audience's reading level; test them with the CDC Clear Communication Index.","Deliver the activity in the field and record attendance and photos.","Evaluate with a pre/post test or process indicators.","Write a 3–5 page report with results and lessons learned."],
proposal:["Choose a review topic with the supervisor; confirm no recent identical review exists (PubMed, PROSPERO, Cochrane).","Write background, gap, question (PICO) and objectives.","Write the methods: databases, full search string, inclusion/exclusion criteria, screening, risk-of-bias tool, synthesis plan.","Register systematic reviews on PROSPERO.","Add a timeline and references; get supervisor sign-off."],
ethics:["Write the full protocol using the institution's IRB template.","Prepare consent forms in Arabic and English, data protection plan and risk–benefit statement.","Make sure your NCBE researcher registration is valid.","Submit to the IRB; keep the submission receipt and the approval/exemption letter."],
review:["Write the review following PRISMA 2020 (systematic) or SANRA (narrative); include the PRISMA flow diagram and checklist.","Choose a Web of Science-indexed journal; follow its author guidelines.","Have the supervisor review the final draft.","Submit; save the submission email and manuscript ID as proof.","Track status; it must be published or accepted before the end of R4."],
white:["Pick a current policy issue with the supervisor.","Write an executive summary (half page).","Describe the problem with data, then summarize the evidence.","Compare 2–3 policy options (benefits, harms, cost, feasibility, equity).","Give one clear recommendation; keep the paper to 4 pages."],
program:["Run a needs assessment and prioritize the problem.","Draw a logic model: inputs, activities, outputs, short- and long-term outcomes.","Write SMART objectives with an indicator for each.","Select evidence-based interventions.","Write the evaluation plan using the CDC framework or RE-AIM: process, outcome and impact measures.","Add budget and timeline."],
peer:["Obtain a manuscript from the supervisor or a journal invitation (keep it confidential).","Summarize the manuscript in one paragraph.","List major comments (design, bias, analysis, conclusions) and minor comments (presentation, language), numbered.","Check reporting guideline compliance and ethics.","Give a recommendation: accept, minor revision, major revision or reject, with reasons. Follow COPE reviewer guidelines."],
ic:["Describe the facility and the problem (e.g., CLABSI rate, hand hygiene compliance).","Use NHSN case definitions; collect surveillance data.","Calculate rates correctly (e.g., per 1,000 device-days).","Do a root-cause analysis (fishbone or 5 Whys).","Give recommendations with an owner and a date; present to the IPC team."],
comm:["Choose a public health issue (e.g., seasonal influenza, heat, MERS).","Analyze audiences: who, what they know, what they fear, trusted channels.","Write three key messages using CERC principles: be first, be right, be credible, express empathy, promote action, show respect.","Plan channels, spokesperson and timing.","Write a one-page media brief: headline, facts, quote, contact.","Define metrics for reach and impact."],
cna:["Define the community geographically and by population.","Collect demographic, epidemiologic and social data (GASTAT, MOH statistics, surveys).","Collect community views (interviews, short survey, focus group).","Map existing services and assets.","Prioritize problems with an explicit method (Hanlon or similar).","Write recommendations and present the profile."],
outbreak:["Follow the CDC steps: prepare, verify diagnosis and outbreak, define cases, find cases.","Describe by time, place and person; draw the epi curve.","Form hypotheses and test them with a case-control or cohort study (OR/RR with CI).","Recommend and follow up control measures.","Communicate findings; write the final report."],
survrep:["Obtain surveillance data for a defined period from the regional or national system.","Clean the data and document the steps.","Analyze trends and rates by age, sex and region.","Present clear tables and graphs.","Interpret and write recommendations with a one-page executive summary."],
surveval:["Follow the CDC 2001 Updated Guidelines for Evaluating Public Health Surveillance Systems.","Describe the system: purpose, case definition, data flow diagram, stakeholders.","Assess the nine attributes: simplicity, flexibility, data quality, acceptability, sensitivity, predictive value positive, representativeness, timeliness, stability.","Judge usefulness; write recommendations."],
poster:["Use the conference's size and template.","Sections: title, introduction, methods, results with clear graphs, conclusion.","Keep text short; make figures readable from 2 meters.","Present it at a conference or research day; keep the acceptance letter or certificate."],
present:["Submit an abstract to a conference or research day.","Prepare 10–15 minutes of slides: background, methods, results, implications.","Rehearse with the supervisor; keep the certificate of presentation."],
original:["Write following the matching reporting guideline (STROBE, CONSORT, etc.).","Choose a Web of Science-indexed journal.","Submit to the program by 1 September of year 4.","Option A: proof of publication or acceptance, no oral defense. Option B: proof of submission plus oral defense before a committee with an external examiner."],
milestone:["Agree on the milestone with the research supervisor.","Complete it and save the evidence (approval letter, dataset, analysis output).","Get the supervisor to sign the milestone form."],
exam:["Attend the formative OSCE/SOE scheduled by the program.","Review the feedback with your mentor.","Write a one-page improvement plan."],
ebm:["Pick the format: CAT, clinical guideline appraisal (AGREE II), or evidence-to-decision report.","Write a structured question, run and document a systematic search.","Appraise the evidence and translate it into a clinical, preventive or policy decision.","Attach supervisor approval and an originality statement. Final deadline: 1 September of year 4."]
};

/* ---------- Resources ---------- */
const L={
casp:["CASP checklists","https://casp-uk.net/casp-tools-checklists/"],jbi:["JBI critical appraisal tools","https://jbi.global/critical-appraisal-tools"],cebm:["Oxford CEBM (levels of evidence, CAT tools)","https://www.cebm.ox.ac.uk/resources"],
equator:["EQUATOR Network (all reporting guidelines)","https://www.equator-network.org/"],prisma:["PRISMA 2020","https://www.prisma-statement.org/"],prospero:["PROSPERO registration","https://www.crd.york.ac.uk/prospero/"],
strobe:["STROBE","https://www.strobe-statement.org/"],consort:["CONSORT","https://www.consort-spirit.org/"],agree:["AGREE II","https://www.agreetrust.org/"],
pubmed:["PubMed","https://pubmed.ncbi.nlm.nih.gov/"],cochrane:["Cochrane Library","https://www.cochranelibrary.com/"],
promed:["ProMED","https://promedmail.org/"],who:["WHO Disease Outbreak News","https://www.who.int/emergencies/disease-outbreak-news"],
ncbe:["National Committee of Bioethics","http://bioethics.kacst.edu.sa/"],vacc:["WHO Vaccine Safety Basics","https://vaccine-safety-training.org/"],
erhms:["CDC/NIOSH ERHMS","https://www.cdc.gov/niosh/erhms/"],cerc:["CDC CERC","https://emergency.cdc.gov/cerc/"],
hl:["CDC Health Literacy course (TRAIN)","https://www.train.org/cdctrain/course/1105934/details"],csc:["Communicating Science Clearly (TRAIN)","https://www.train.org/cdctrain/course/1112747/details"],
ccindex:["CDC Clear Communication Index","https://www.cdc.gov/ccindex/"],ctb:["Community Tool Box (Univ. of Kansas)","https://ctb.ku.edu/en"],
evalfw:["CDC Program Evaluation Framework","https://www.cdc.gov/evaluation/"],reaim:["RE-AIM","https://re-aim.org/"],
cope:["COPE ethical guidelines for peer reviewers","https://publicationethics.org/guidance"],nhsn:["CDC NHSN","https://www.cdc.gov/nhsn/"],ipc:["WHO Infection Prevention and Control","https://www.who.int/health-topics/infection-prevention-and-control"],
fem:["CDC Field Epidemiology Manual","https://www.cdc.gov/field-epi-manual/"],survg:["CDC Guidelines for Evaluating Surveillance Systems (MMWR 2001)","https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5013a1.htm"],
gastat:["GASTAT statistics","https://www.stats.gov.sa/"],moh:["Saudi MOH statistical yearbook","https://www.moh.gov.sa/en/Ministry/Statistics/book/Pages/default.aspx"],
scfhs:["SCFHS (curriculum, bylaws, forms)","https://www.scfhs.org.sa/"],wos:["Web of Science Master Journal List","https://mjl.clarivate.com/"]
};
const RES={course:["scfhs"],cap:["casp","jbi","cebm","equator"],cat:["cebm","pubmed","cochrane","casp"],seminar:["promed","who","pubmed"],cbd:["scfhs"],minicex:["scfhs"],cot:["scfhs"],logbook:["scfhs"],iter:["scfhs"],portfolio:["scfhs"],volunteer:["scfhs"],hep:["ccindex","hl","ctb"],proposal:["prospero","prisma","pubmed","cochrane"],ethics:["ncbe"],review:["prisma","equator","wos"],white:["ctb","pubmed"],program:["evalfw","reaim","ctb"],peer:["cope","equator"],ic:["nhsn","ipc"],comm:["cerc","ccindex"],cna:["ctb","gastat","moh"],outbreak:["fem","who"],survrep:["fem","moh"],surveval:["survg"],poster:["equator"],present:["equator"],original:["strobe","consort","equator","wos"],milestone:["ncbe"],exam:["scfhs"],ebm:["cebm","agree","pubmed"]};

/* ---------- Requirements: [month/window, title, type, proposed?, extra resource keys] ---------- */
const COMMON=[["2/yr","CAP – Critically Appraised Paper","cap"],["R2–R4","CAT – Critically Appraised Topic","cat"],["2/yr","Seminars","seminar"],["2–3/yr","CBD – Case-Based Discussion","cbd"],["4/yr","Mini-CEX","minicex"],["2/yr","COT – Consultation Observation Tool","cot",1],["JUL","Logbook","logbook"],["JUL","ITERs","iter"],["JAN · JUL","Portfolio","portfolio"],["10 h/yr","Volunteering (40 h total)","volunteer",1]];
const LV={
r1:{t:"R1 – Foundation",d:"Build the base: mandatory courses, research ethics, and the proposal for the first research project (review article).",items:[
["OCT–NOV","Communicating Science Clearly (online course)","course",1,["csc"]],
["NOV","COT #1","cot",1],
["DEC","Communication Skills for Healthcare Professionals *","course",0],
["DEC","NCBE certificate","course",0,["ncbe"]],
["NOV–JAN","Health Literacy (CDC online course)","course",1,["hl"]],
["JAN","Patient Safety *","course"],
["JAN","Portfolio mid-year review","portfolio",1],
["JAN–FEB","Mini-CEX #1–2 (mid-year)","minicex",1],
["FEB","1 CAP","cap"],
["MAR","Introduction \"Medical Fundamentals\" *","course"],
["MAR","Medical and Surgical Emergencies *","course"],
["MAR","Health education project","hep"],
["APR","2 Seminars","seminar"],
["MAR–MAY","COT #2","cot",1],
["APR–MAY","EBM structured appraisal #1","cap",1],
["MAY","Research Proposal","proposal"],
["JUN","2 CBD","cbd"],
["JUL","ITERs","iter"],["JUL","Logbook","logbook"],["JUL","2 Mini-CEX","minicex"],["JUL","Volunteering check (10 h)","volunteer",1]]},
r2:{t:"R2 – Deepening",d:"Finish and submit the review article before the promotion exam, build EBM skills, and sit Part 1.",items:[
["OCT","WHO Vaccine Safety online course","course",0,["vacc"]],
["OCT–NOV","COT #1","cot",1],
["NOV","Research Methods *","course"],
["NOV–DEC","CAT #1","cat",1],
["DEC","Research protocol ethical review document","ethics"],
["DEC–JAN","EBM structured appraisal #2","cap",1],
["JAN","Portfolio mid-year review","portfolio",1],
["JAN–FEB","Mini-CEX #1–2 (mid-year)","minicex",1],
["JAN–FEB","White paper","white",1],
["FEB","Evidence Based Practice *","course"],
["MAR","1 CAP","cap"],
["MAR–APR","CAT #2","cat",1],
["MAR–MAY","COT #2","cot",1],
["APR","2 Seminars","seminar"],
["MAY","Diabetes and Metabolic Disorders *","course"],
["MAY","Cancer *","course"],
["≥6 wks pre-exam","Formative OSCE / SOE","exam",1],
["JUN","Manuscript submitted for publication (Review)","review"],
["JUN","2 CBD","cbd"],
["JUL","ITERs","iter"],["JUL","Logbook","logbook"],["JUL","2 Mini-CEX","minicex"],["JUL","Volunteering check (10 h)","volunteer",1]]},
r3:{t:"R3 – Application",d:"Move from learning to doing: program planning and evaluation, infection control, public communication, and starting original research.",items:[
["OCT","Infection Prevention and Control *","course"],
["OCT–NOV","COT #1","cot",1],
["OCT–DEC","Original research protocol + IRB approval","milestone",1,["ncbe"]],
["NOV","Frail Elderly Patients *","course"],
["NOV","Ethics and Healthcare *","course"],
["DEC","Program plan / Evaluation report","program"],
["NOV–JAN","CAT #2","cat",1],
["JAN","Code of Ethics *","course"],
["JAN","Portfolio mid-year review + review-article status check","portfolio",1],
["JAN–FEB","CERC (CDC online course)","course",1,["cerc"]],
["FEB","Peer review of manuscript / article","peer"],
["FEB","Mini-CEX #1–2 (mid-year)","minicex",1],
["MAR","Infection control report","ic"],
["MAR","1 CAP","cap"],["MAR","1 CAT","cat"],
["APR","2 Seminars","seminar"],
["MAY","Communication plan (including media brief)","comm"],
["MAR–MAY","COT #2","cot",1],
["JUN","Community profile / health needs assessment","cna"],
["JAN–JUN","Data collection completed","milestone",1],
["JUL","2 CBD","cbd"],
["JUL","ITERs","iter"],["JUL","Logbook","logbook"],["JUL","2 Mini-CEX","minicex"],["JUL","Volunteering check (10 h)","volunteer",1]]},
r4:{t:"R4 – Independence",d:"Work as a consultant: outbreak investigation, surveillance and its evaluation, and publishing original research. The research must reach the program by 1 September to qualify for Part 2 of the final exam.",items:[
["OCT–NOV","ERHMS (CDC/NIOSH online course)","course",1,["erhms"]],
["OCT–NOV","Data analysis completed","milestone",1],
["OCT","COT #1","cot",1],
["DEC","1 CAP","cap"],["DEC","1 CAT","cat"],
["JAN","Outbreak or disease cluster investigation","outbreak"],
["JAN","Portfolio mid-year review","portfolio",1],
["JAN","Mini-CEX #1–2 (mid-year)","minicex",1],
["FEB","Surveillance report","survrep"],
["FEB","Surveillance evaluation","surveval"],
["MAR","3 CBD","cbd"],
["MAR","COT #2","cot",1],
["MAR–APR","CAT #2 = standalone EBM assignment","ebm",1],
["APR","2 Seminars","seminar"],
["≥6 wks pre-exam","Formative OSCE / SOE","exam",1],
["MAY","Research poster","poster"],
["MAY","Scientific presentation","present"],
["JUN","Manuscript submitted for publication (Original)","original"],
["JUL","ITERs","iter"],["JUL","Logbook","logbook"],["JUL","2 Mini-CEX","minicex"],["JUL","Volunteering check (10 h, 40 h total)","volunteer",1]]}
};


// Required file type and how to submit, per requirement type.
const FILES={
  pdf:{ext:['pdf'],label:'PDF',how:'One PDF file named Name_Level_Requirement.pdf'},
  slides:{ext:['pdf','pptx'],label:'PDF or PowerPoint',how:'The slides (PPTX) or a PDF of them, with the signed evaluation form as the last page'},
  doc:{ext:['pdf','docx'],label:'PDF or Word',how:'A written report (Word or PDF) with a cover page and references, signed form attached at the end'},
  form:{ext:['pdf','jpg','jpeg','png'],label:'PDF or image',how:'A clear photo or scan of the form signed by the assessor (PDF preferred)'},
  bundle:{ext:['pdf','zip'],label:'PDF or ZIP',how:'One combined PDF, or a ZIP with all evidence organized in folders'}
};
const FTYPE={course:'pdf',cap:'slides',cat:'doc',seminar:'slides',cbd:'form',minicex:'form',cot:'form',logbook:'pdf',iter:'pdf',portfolio:'bundle',volunteer:'pdf',hep:'doc',proposal:'doc',ethics:'doc',review:'doc',white:'doc',program:'doc',peer:'doc',ic:'doc',comm:'doc',cna:'doc',outbreak:'doc',survrep:'doc',surveval:'doc',poster:'pdf',present:'slides',original:'doc',milestone:'bundle',exam:'pdf',ebm:'doc'};

const MON={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
// The training year starts in October of yearStart. Returns the open/close window from a month label.
function windowFor(label,yearStart){
  const ms=(label.match(/[A-Z]{3}/g)||[]).filter(m=>MON[m]);
  if(!ms.length) return null;
  const y=m=>MON[m]>=10?yearStart:yearStart+1;
  const f=ms[0],l=ms[ms.length-1];
  const open=new Date(Date.UTC(y(f),MON[f]-1,1,-3,0)); // 00:00 Riyadh time
  const close=new Date(Date.UTC(y(l),MON[l],0,20,59)); // 23:59 Riyadh time
  return {openAt:open.toISOString(),closeAt:close.toISOString()};
}

// The program's official promotion list (R1–R4): only these requirements, with these exact titles.
const OFFICIAL_TITLES={"r1-003": "Communication Skills for Healthcare Professionals*","r1-004": "NCBE certificate","r1-006": "Patient Safety*","r1-009": "1 CAP","r1-010": "Introduction “Medical Fundamentals” *","r1-011": "Medical and Surgical Emergencies*","r1-012": "Health education project","r1-013": "2 Seminars","r1-016": "Research Proposal","r1-017": "2 CBD","r1-018": "ITERs","r1-019": "Logbook","r1-020": "2 Mini-Cex","r2-022": "WHO Vaccine safety online course","r2-024": "Research Methods*","r2-026": "Research protocol ethical review document","r2-031": "Evidence Based Practice*","r2-032": "1 CAP","r2-035": "2 Seminars","r2-036": "Diabetes and Metabolic Disorders*","r2-037": "Cancer*","r2-039": "Manuscript submitted for publication (Review)","r2-040": "2 CBD","r2-041": "ITERs","r2-042": "Logbook","r2-043": "2 Mini-Cex","r3-045": "Infection Prevention and Control*","r3-048": "Frail Elderly Patients*","r3-049": "Ethics and Healthcare*","r3-050": "Program plan/ Evaluation report","r3-052": "Code of Ethics*","r3-055": "peer-review of manuscript/ article","r3-057": "Infection control report","r3-058": "1 CAP","r3-059": "1 CAT","r3-060": "2 Seminars","r3-061": "Communication plan (including media brief)","r3-063": "Community Profile/ health needs assessment","r3-065": "2 CBD","r3-066": "ITERs","r3-067": "Logbook","r3-068": "2 Mini-Cex","r4-073": "1 CAP","r4-074": "1 CAT","r4-075": "Outbreak or disease cluster investigations","r4-078": "Surveillance report","r4-079": "Surveillance evaluation","r4-080": "3 CBD","r4-083": "2 Seminars","r4-085": "Research Poster","r4-086": "Scientific presentation","r4-087": "Manuscript submitted for publication (Original)","r4-088": "ITERs","r4-089": "Logbook","r4-090": "2 Mini-Cex"};

// Presented in turn at the weekly Thursday sessions, so these stay open all training year.
const YEAR_LONG_TYPES=['cap','cat','seminar','cbd','minicex','cot'];
const YEAR_LONG_WINDOW='OCT–JUL';
const YEAR_LONG_STEP='Upload after your Thursday session. The window stays open the whole training year, until 31 July.';

function seedRequirements(yearStart){
  const out=[];let n=0;
  for(const lv of ['r1','r2','r3','r4']){
    for(const [win,title,type,proposed,extra] of LV[lv].items){
      const id=`${lv}-${String(++n).padStart(3,'0')}`;
      if(!OFFICIAL_TITLES[id]) continue;
      const yearLong=YEAR_LONG_TYPES.includes(type);
      const label=yearLong?YEAR_LONG_WINDOW:win;
      const w=windowFor(label,yearStart);
      const ft=FILES[FTYPE[type]];
      out.push({
        id,level:lv.toUpperCase(),window:label,title:OFFICIAL_TITLES[id],type,proposed:false,
        description:LV[lv].d,
        instructions:yearLong?[...I[type],YEAR_LONG_STEP]:I[type],
        rubric:R[type].map(([name,max])=>({name,max})),
        resources:[...new Set([...(extra||[]),...RES[type]])].map(k=>({title:L[k][0],url:L[k][1]})),
        fileTypes:ft.ext,fileLabel:ft.label,howToSubmit:ft.how,maxMB:25,
        openAt:w?w.openAt:null,closeAt:w?w.closeAt:null,lateDays:14,published:!!w
      });
    }
  }
  return out;
}

// Original month labels, for moving already-seeded databases to the year-long schedule.
function originalLabels(){
  const out={};let n=0;
  for(const lv of ['r1','r2','r3','r4']) for(const [win] of LV[lv].items) out[`${lv}-${String(++n).padStart(3,'0')}`]=win;
  return out;
}

module.exports={seedRequirements,windowFor,originalLabels,OFFICIAL_TITLES,YEAR_LONG_TYPES,YEAR_LONG_WINDOW,YEAR_LONG_STEP,LINKS:L,LEVEL_INFO:Object.fromEntries(Object.entries(LV).map(([k,v])=>[k.toUpperCase(),{title:v.t,desc:v.d}]))};
