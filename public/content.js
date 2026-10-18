'use strict';
// Board website text. Edit freely: everything here is shown on the public pages.
// Leave a field empty ('') to hide it.
// Program content is taken from the SCFHS Saudi Board of Preventive Medicine curriculum (2022).

window.SITE = {
  board: 'Preventive Medicine Board',
  hospital: 'Armed Forces Hospital Southern Region',
  short: 'AFHSR',
  source: 'Saudi Board of Preventive Medicine curriculum, Saudi Commission for Health Specialties (SCFHS), 2022',
  sourceUrl: 'https://scfhs.org.sa/sites/default/files/2022-05/6592%20Preventive_Medicine_2022.pdf',

  hero: {
    kicker: 'Saudi Board of Preventive Medicine · Residency Training',
    title: 'Training the guardians of population health',
    text: 'A four-year residency that combines clinical practice with public health sciences, preparing physicians to prevent disease, protect communities and lead public health programs.',
  },

  quote: '“An ounce of prevention is worth a pound of cure.”',

  welcome: {
    title: 'Welcome to our trainees',
    paragraphs: [
      'Welcome to the Preventive Medicine training program at the Armed Forces Hospital Southern Region.',
      'Preventive medicine looks beyond the single patient to the health of whole communities. Over four years you will train in hospitals, in the field and in research, and graduate ready to work as a preventive medicine specialist and public health leader.',
      'This website brings the program together: what the specialty is, how training is organized, what is expected at each level, and the trainee portal for submitting your promotion requirements.',
    ],
    signature: 'Program Administration',
  },

  facts: [
    ['4', 'years of residency (R1–R4)'],
    ['6', 'two-month rotations each year'],
    ['2', 'research projects: a review and an original study'],
    ['Thursday', 'weekly academic half-day'],
  ],

  about: {
    intro: 'The Preventive Medicine Board program at the Armed Forces Hospital Southern Region trains physicians under the Saudi Board of Preventive Medicine (SBPM) of the Saudi Commission for Health Specialties. Training follows the national SBPM curriculum and combines academic courses, hospital rotations, longitudinal preventive clinics, field rotations, research and a weekly academic half-day.',
    history: [
      'The Saudi Board of Preventive Medicine began in 2009 under the SCFHS as the Saudi Board of Community Medicine, in a single training center in Jeddah, and soon expanded to Riyadh, Abha, Madinah, Taif and Makkah.',
      'It replaced the Arab Board of Community Medicine, which had started in Jeddah in 1991. The specialty’s scientific council later approved the new name, Saudi Board of Preventive Medicine.',
    ],
    why: 'Saudi Arabia faces a double burden: a rapid rise in preventable, lifestyle-related non-communicable diseases, alongside outbreaks and continued transmission of infectious diseases. Cost-effectiveness studies show that prevention programs reduce healthcare costs in the long term — and the country needs many more public health physicians to lead them.',
    goals: [
      'Demonstrate comprehensive knowledge of the science and art of preventive medicine, and apply it to population health issues in their social, economic, political and environmental context.',
      'Assess the determinants of health of the populations they serve — income, environment, gender, education, social support, health behaviors and access to care — and use them in research and in strategies to improve health.',
      'Graduate as competent preventive medicine specialists able to take public health leadership and management roles, and to act as consultants in the specialty.',
      'Develop deeper expertise in a related field such as communicable disease, environmental health or chronic disease, and in an area of personal interest such as education, global health, leadership or occupational health.',
    ],
  },

  specialty: {
    definition: 'Preventive medicine is a medical specialty primarily concerned with the health of populations. Its focus is the prevention and control of disease and injury through health protection and health promotion. Preventive medicine specialists monitor and assess the health needs of a population and develop, implement and evaluate strategies to improve health and well-being.',
    scope: 'Building on clinical medicine and the determinants of health, specialists work in epidemiology, biostatistics and surveillance; planning and evaluating programs and policies; leadership, collaboration and advocacy; and primary, secondary and tertiary prevention and communication.',
    settings: ['Government health agencies', 'Hospitals and infection control', 'Occupational medicine', 'Academia and research', 'Non-governmental organizations', 'Global health'],
    roles: ['Leadership and management', 'Epidemiology', 'Environmental health', 'Communicable disease control', 'Non-communicable disease prevention', 'Mental health'],
    careers: 'Graduates work as preventive medicine specialists and consultants — as advisors, medical health officers, executives, managers, researchers or educators — or continue to a sub-specialty such as epidemiology, occupational health, environmental health, child and adolescent health, or mental health.',
    burden: {
      mortality: ['Ischemic heart disease', 'Road injuries', 'Cerebrovascular disease', 'Congenital defects', 'Lower respiratory infection', 'Chronic kidney disease', 'Neonatal preterm birth', 'Alzheimer’s disease', 'Neonatal sepsis', 'Diabetes'],
      risks: ['Dietary risks', 'High body-mass index', 'High systolic blood pressure', 'High fasting plasma glucose', 'High total cholesterol', 'Air pollution', 'Tobacco smoke', 'Low glomerular filtration rate', 'Low physical activity', 'Occupational risks'],
      emergencies: ['Pandemics and outbreaks', 'Natural disasters', 'Chemical hazards', 'Radiation hazards', 'Bioterrorism', 'Needlestick injuries', 'Food poisoning', 'War', 'Refugees', 'Temperature extremes'],
    },
  },

  program: {
    intro: 'The program has five areas of activity: academic training, clinical training (hospital rotations and longitudinal preventive clinics), field rotations, research, and weekly academic half-days. Each training year has six two-month rotations, with one day a week protected for academic activities and research, and one elective rotation a year. Over the four years, one elective is a mass-gathering (Hajj and Umrah) rotation.',
    years: [
      { level: 'R1', title: 'Foundations', focus: 'Epidemiology, biostatistics and the basics of public health, then hospital rotations.',
        items: ['Principles of epidemiology', 'Principles of biostatistics', 'Statistical methods in preventive medicine', 'Writing health-related research proposals', 'Principles of environmental health', 'Social & behavioral sciences', 'Health behavior and health education', 'Health system and services', 'Fundamentals of health care management', 'Introduction to health economics', 'Critical appraisal', 'Report-writing skills', 'Hospital rotations: internal medicine, pediatrics', 'Elective rotation'] },
      { level: 'R2', title: 'Disease control & clinical practice', focus: 'Communicable and non-communicable disease control, ethics and occupational health, with hospital rotations.',
        items: ['Epidemiology and control of communicable diseases (incl. outbreak investigation)', 'Epidemiology and control of non-communicable diseases (cancers, injuries, CVD, diabetes, obesity)', 'Introduction to clinical preventive services', 'Ethics in preventive medicine', 'Principles of occupational health', 'Hospital rotations: emergency medicine, family medicine (general, well baby, antenatal), psychiatry or occupational medicine', 'Elective rotation'] },
      { level: 'R3', title: 'Field practice', focus: 'Advanced methods and the first field rotations, plus a weekly preventive clinic.',
        items: ['Advanced epidemiology', 'Health planning and evaluation', 'Disaster preparedness and response', 'Demography and health', 'Maternal & child health', 'Infection control', 'Experimental designs', 'Communicating public health information', 'Field rotations: communicable diseases, infection control, environmental health', 'Clinical preventive services clinic (weekly)', 'Elective rotation (including two weeks of research data collection)'] },
      { level: 'R4', title: 'Leadership & independence', focus: 'Surveillance and non-communicable disease field work, policy and global health, and an elective field rotation.',
        items: ['Field rotations: non-communicable diseases, surveillance', 'Systematic review & meta-analysis', 'Health care quality and patient safety', 'Biologic basis of vaccine development', 'Principles of health informatics', 'Public health policy', 'International health', 'Public health toxicology', 'Mental health', 'Nutrition in health & disease', 'Vector biology and vector-borne diseases', 'Elective field rotation (e.g. occupational health, health promotion, policy & management, MCH, school health, cancer control)', 'Clinical preventive services clinic (weekly)'] },
    ],
    hospital: 'Ten months of hospital training in internal medicine (infectious diseases, geriatrics, cardiology, endocrinology), pediatrics, emergency medicine, family medicine, and psychiatry or occupational medicine. Residents join clinical teams and are evaluated monthly and at the end of each rotation.',
    clinics: ['Smoking cessation', 'Physical activity counseling', 'Preventive cardiology', 'Clinical risk assessment', 'Tuberculosis screening and control', 'Immunization (child and adult)', 'Well-baby', 'Travel medicine', 'Screening (cancer, prenatal, NCD)'],
    field: ['Communicable disease control', 'Environmental health', 'Infection control', 'Non-communicable diseases', 'Surveillance'],
    fieldNote: 'In R3 and R4 residents spend five two-month field rotations at accredited sites, with personal learning objectives agreed with the supervisor, on-call duty in communicable disease and infection control rotations, and a reflective report and seminar project at the end of each rotation.',
  },

  competencies: {
    intro: 'Training follows the CanMEDS framework. On completion, residents function effectively in seven roles:',
    roles: [
      ['Medical expert', 'Integrates all roles, applying medical knowledge, clinical and preventive skills and professional attitudes at individual, community and population levels.'],
      ['Communicator', 'Builds effective, trusting relationships with individuals, families, groups, organizations, communities and populations.'],
      ['Collaborator', 'Works effectively with others to achieve optimal health outcomes.'],
      ['Manager', 'Organizes sustainable practices, allocates resources and contributes to effective health and other systems.'],
      ['Health advocate', 'Uses expertise and influence to advance the health and well-being of individuals, communities and populations.'],
      ['Scholar', 'Commits to lifelong reflective learning and to creating, applying and translating knowledge.'],
      ['Professional', 'Committed to the health of individuals and society through ethical practice and high personal standards.'],
    ],
  },

  research: {
    intro: 'Every resident completes two research projects during the residency.',
    projects: [
      ['R1–R2 · Review article', 'One systematic or narrative review, completed and submitted to the supervisor before the Year 2 promotion exam, and published or accepted in an ISI journal before the end of Year 4.'],
      ['R3–R4 · Original research', 'One original study, submitted as a publishable manuscript by 1 September of Year 4 to be eligible for Part 2 of the final exam — with proof of publication/acceptance (no oral defense), or proof of submission plus an oral defense before a committee with an external examiner.'],
    ],
    support: 'Residents have a weekly half-day of protected research time, and in R3 two full weeks for data collection during the elective rotation.',
  },

  assessment: {
    intro: 'Residents are assessed throughout the four years against the program’s competencies and objectives.',
    types: [
      ['High-stakes exams', 'Part 1 and the Part 2 final exam, organized by the SCFHS Scientific Exam Committee.'],
      ['Continuous formative assessment', 'At the end of each course, discussed with trainees; plus Mini-CEX for preventive clinical skills. Not counted toward summative scores.'],
      ['Continuous summative assessment', 'Determines promotion each year and, in R4, eligibility for the final exam — combining written promotion exams, academic and research activities, logbook/portfolio, community activities, OSCE/OSPE and ITERs.'],
      ['ITERs', 'In-Training Evaluation Reports at mid- and end-point of each rotation, discussed with the resident.'],
      ['Promotion requirements', 'A defined portfolio of requirements for each level, submitted to the program before the due dates.'],
    ],
  },

  academicDay: 'Every Thursday',

  // Contact details shown in the footer and on the About page. Empty = hidden.
  contact: {
    email: '',
    phone: '',
    location: 'Armed Forces Hospital Southern Region',
  },
};
