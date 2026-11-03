'use strict';
// Exams seeded into the database on first start. Correct answers stay on the server.
// T1: R1 epidemiology course exam (2026–27). Correct answers are those marked in red in the source file.

const EXAMS = [
 {
  "id": "t1",
  "title": "T1 Exam — Epidemiology (R1)",
  "level": "R1",
  "course": "R1 epidemiology course",
  "password": "AFHSR26",
  "openAt": "2026-11-10T21:00:00.000Z",
  "closeAt": "2026-11-11T20:59:00.000Z",
  "durationMin": 60,
  "groups": {
   "curves": {
    "stem": "Match each description with the epidemic curve (A–D) shown in the figures.",
    "images": [
     "exams/t1/curve-A.gif",
     "exams/t1/curve-B.gif",
     "exams/t1/curve-C.gif",
     "exams/t1/curve-D.gif"
    ]
   },
   "lab": {
    "stem": "A hospital laboratory is asked to test 200 specimens of urine, of which 100 are known to contain glucose; the remaining 100 are free of glucose. The laboratory reports 130 with glucose, 90 of which were known to contain glucose."
   }
  },
  "items": [
   {
    "id": "q1",
    "text": "While investigating a point source epidemic it was found that 120 students ate five different foods (meat burgers, fried fish, steak, rice and fruit salad). The relative risk was calculated for all those five foods. It was concluded that fish was not responsible for this epidemic. The relative risk of fish is:",
    "options": [
     {
      "id": "a",
      "text": "1"
     },
     {
      "id": "b",
      "text": "1.2"
     },
     {
      "id": "c",
      "text": "1.7"
     },
     {
      "id": "d",
      "text": "3.0"
     },
     {
      "id": "e",
      "text": "7.0"
     }
    ],
    "answer": "a"
   },
   {
    "id": "q2",
    "text": "In a prospective study of the relationship between oral contraceptive use and the subsequent risk of developing endometrial cancer, a cohort of 1000 women were followed for 5 years. The results were as shown in the table. What is the incidence rate (absolute risk) of endometrial cancer among women who didn’t use oral contraceptives?",
    "options": [
     {
      "id": "a",
      "text": "630 / (50 + 630)"
     },
     {
      "id": "b",
      "text": "75 / (245 + 75)"
     },
     {
      "id": "c",
      "text": "50 / (50 + 630)"
     },
     {
      "id": "d",
      "text": "245 / (245 + 75)"
     }
    ],
    "answer": "c",
    "table": {
     "head": [
      "",
      "Endometrial cancer present",
      "Endometrial cancer absent"
     ],
     "rows": [
      [
       "Used oral contraceptives",
       "A = 245",
       "B = 75"
      ],
      [
       "Did not use oral contraceptives",
       "C = 50",
       "D = 630"
      ],
      [
       "Total",
       "A + C = 295",
       "B + D = 705  (n = 1000)"
      ]
     ]
    }
   },
   {
    "id": "q3",
    "text": "A number of passengers on a cruise ship from Puerto Rico to the Panama Canal have recently developed a gastrointestinal illness compatible with norovirus (formerly called Norwalk-like virus). Testing for norovirus is not readily available in any nearby island, and the test takes several days even where available. Assuming you are the epidemiologist called on to board the ship and investigate this possible outbreak, your case definition should include, at a minimum: (Choose one best answer)",
    "options": [
     {
      "id": "a",
      "text": "Clinical criteria, plus specification of time, place, and person"
     },
     {
      "id": "b",
      "text": "Clinical features, plus the exposure(s) you most suspect"
     },
     {
      "id": "c",
      "text": "Suspect cases"
     },
     {
      "id": "d",
      "text": "The nationally agreed standard case definition for disease reporting"
     }
    ],
    "answer": "a"
   },
   {
    "id": "q4",
    "text": "Which of the following is not true about specific case definition?",
    "options": [
     {
      "id": "a",
      "text": "Is likely to include only (or mostly) true cases"
     },
     {
      "id": "b",
      "text": "Is considered “loose” or “broad”"
     },
     {
      "id": "c",
      "text": "Will include more cases than a sensitive case definition"
     },
     {
      "id": "d",
      "text": "May exclude mild cases"
     }
    ],
    "answer": "c",
    "keyNote": "Check the question: “Is considered loose or broad” is also not true of a specific case definition."
   },
   {
    "id": "q5",
    "text": "When analyzing surveillance data by age, which of the following age groups is preferred? (Choose one best answer)",
    "options": [
     {
      "id": "a",
      "text": "1-year age groups"
     },
     {
      "id": "b",
      "text": "5-year age groups"
     },
     {
      "id": "c",
      "text": "10-year age groups"
     },
     {
      "id": "d",
      "text": "Depends on the disease"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q6",
    "text": "British investigators conducted a study to compare measles-mumps-rubella (MMR) vaccine history among 1,294 children with pervasive development disorder (e.g., autism and Asperger’s syndrome) and 4,469 children without such disorders. (They found no association.) This is an example of which type(s) of study?",
    "options": [
     {
      "id": "a",
      "text": "Experimental"
     },
     {
      "id": "b",
      "text": "Cohort"
     },
     {
      "id": "c",
      "text": "Case-control"
     },
     {
      "id": "d",
      "text": "Clinical trial"
     }
    ],
    "answer": "c"
   },
   {
    "id": "q7",
    "text": "A cohort study differs from a case-control study in that:",
    "options": [
     {
      "id": "a",
      "text": "Subjects are enrolled or categorized on the basis of their exposure status in a cohort study but not in a case-control study"
     },
     {
      "id": "b",
      "text": "Subjects are asked about their exposure status in a cohort study but not in a case-control study"
     },
     {
      "id": "c",
      "text": "Cohort studies require many years to conduct, but case-control studies do not"
     },
     {
      "id": "d",
      "text": "Cohort studies are conducted to investigate chronic diseases, case-control studies are used for infectious diseases"
     }
    ],
    "answer": "a"
   },
   {
    "id": "q8",
    "text": "A propagated epidemic is usually the result of what type of exposure?",
    "options": [
     {
      "id": "a",
      "text": "Point source"
     },
     {
      "id": "b",
      "text": "Continuous common source"
     },
     {
      "id": "c",
      "text": "Intermittent common source"
     },
     {
      "id": "d",
      "text": "Person-to-person"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q9",
    "text": "In an outbreak of cholera in a village of 2,000 population, 20 cases have occurred and 5 died. Case fatality rate is:",
    "options": [
     {
      "id": "a",
      "text": "1%"
     },
     {
      "id": "b",
      "text": ".25%"
     },
     {
      "id": "c",
      "text": "5%"
     },
     {
      "id": "d",
      "text": "25%"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q10",
    "text": "In a population of 1000, measles coverage is 60%, one child goes out of station and comes back with measles from whom 20 more children get measles. Secondary attack rate of measles is:",
    "options": [
     {
      "id": "a",
      "text": "0.65%"
     },
     {
      "id": "b",
      "text": "5%"
     },
     {
      "id": "c",
      "text": "6%"
     },
     {
      "id": "d",
      "text": "6.5%"
     }
    ],
    "answer": "b"
   },
   {
    "id": "q11",
    "text": "A researcher wanted to study the time sequence to prove the concept of causativity, which design of study should be preferred by the researcher:",
    "options": [
     {
      "id": "a",
      "text": "Longitudinal"
     },
     {
      "id": "b",
      "text": "Cross-sectional"
     },
     {
      "id": "c",
      "text": "Case report"
     },
     {
      "id": "d",
      "text": "Case series report"
     },
     {
      "id": "e",
      "text": "Quasi experimental"
     }
    ],
    "answer": "a"
   },
   {
    "id": "q12",
    "group": "curves",
    "fixedOptions": true,
    "text": "Shows a rapid increase and decrease in cases over time.",
    "options": [
     {
      "id": "a",
      "text": "Curve A"
     },
     {
      "id": "b",
      "text": "Curve B"
     },
     {
      "id": "c",
      "text": "Curve C"
     },
     {
      "id": "d",
      "text": "Curve D"
     }
    ],
    "answer": "a"
   },
   {
    "id": "q13",
    "group": "curves",
    "fixedOptions": true,
    "text": "Shows many cases over a long period of time.",
    "options": [
     {
      "id": "a",
      "text": "Curve A"
     },
     {
      "id": "b",
      "text": "Curve B"
     },
     {
      "id": "c",
      "text": "Curve C"
     },
     {
      "id": "d",
      "text": "Curve D"
     }
    ],
    "answer": "b"
   },
   {
    "id": "q14",
    "group": "curves",
    "fixedOptions": true,
    "text": "There is no obvious peak.",
    "options": [
     {
      "id": "a",
      "text": "Curve A"
     },
     {
      "id": "b",
      "text": "Curve B"
     },
     {
      "id": "c",
      "text": "Curve C"
     },
     {
      "id": "d",
      "text": "Curve D"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q15",
    "group": "curves",
    "fixedOptions": true,
    "text": "Shows 3 small peaks several days apart. No cases occur between peaks.",
    "options": [
     {
      "id": "a",
      "text": "Curve A"
     },
     {
      "id": "b",
      "text": "Curve B"
     },
     {
      "id": "c",
      "text": "Curve C"
     },
     {
      "id": "d",
      "text": "Curve D"
     }
    ],
    "answer": "c"
   },
   {
    "id": "q16",
    "text": "An epidemiologist sets out to create an epidemic curve for a novel coronavirus traveling through his community. As expected, she discovers that the only route of transmission is person to person through respiratory droplets. What type of pattern will be seen on the epidemic curve?",
    "options": [
     {
      "id": "a",
      "text": "Common source"
     },
     {
      "id": "b",
      "text": "Mixed"
     },
     {
      "id": "c",
      "text": "Continuous common source"
     },
     {
      "id": "d",
      "text": "Propagated"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q17",
    "text": "The sensitivity of this laboratory test is:",
    "options": [
     {
      "id": "a",
      "text": "88.8%"
     },
     {
      "id": "b",
      "text": "90.0%"
     },
     {
      "id": "c",
      "text": "96.2%"
     },
     {
      "id": "d",
      "text": "98.1%"
     }
    ],
    "answer": "b",
    "group": "lab"
   },
   {
    "id": "q19",
    "text": "The predictive power of a positive test is:",
    "options": [
     {
      "id": "a",
      "text": "66.2%"
     },
     {
      "id": "b",
      "text": "68.0%"
     },
     {
      "id": "c",
      "text": "69.2%"
     },
     {
      "id": "d",
      "text": "72.3%"
     }
    ],
    "answer": "c",
    "group": "lab"
   },
   {
    "id": "q20",
    "text": "The predictive power of a negative test is:",
    "options": [
     {
      "id": "a",
      "text": "90.5%"
     },
     {
      "id": "b",
      "text": "96.3%"
     },
     {
      "id": "c",
      "text": "97.4%"
     },
     {
      "id": "d",
      "text": "85.7%"
     }
    ],
    "answer": "d",
    "group": "lab"
   },
   {
    "id": "q21",
    "text": "Prophylactic administration of vitamin K in breast fed babies is an example of:",
    "options": [
     {
      "id": "a",
      "text": "Health Promotion"
     },
     {
      "id": "b",
      "text": "Treatment"
     },
     {
      "id": "c",
      "text": "Specific protection"
     },
     {
      "id": "d",
      "text": "Rehabilitation"
     },
     {
      "id": "e",
      "text": "Primordial prevention"
     }
    ],
    "answer": "c"
   },
   {
    "id": "q22",
    "text": "To compare the death rate of Saudi Arabia with the death rate of Canada, the Most appropriate measure is a comparison between:",
    "options": [
     {
      "id": "a",
      "text": "Age specific mortality rates"
     },
     {
      "id": "b",
      "text": "Crude death rates"
     },
     {
      "id": "c",
      "text": "Maternal mortality rates"
     },
     {
      "id": "d",
      "text": "Standardized mortality rates"
     },
     {
      "id": "e",
      "text": "Life expectancy"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q23",
    "text": "The annual report of King Fahd Hospital for the year 2006 shows 200 cases of Myocardial Infarction, 35 cases of Cholecystitis, 105 cases of Pneumonia and 350 cases of Acute Gastroenteritis. The result of this report cannot be generalized on the total population of Jeddah on account of:",
    "options": [
     {
      "id": "a",
      "text": "Confounding bias"
     },
     {
      "id": "b",
      "text": "Memory bias"
     },
     {
      "id": "c",
      "text": "Selection bias"
     },
     {
      "id": "d",
      "text": "Berkesonian bias"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q24",
    "text": "To be causally associated with disease, the etiological factor should fulfill the following criteria: (indicate all that apply)",
    "options": [
     {
      "id": "a",
      "text": "The factor is present in all subjects with the disease"
     },
     {
      "id": "b",
      "text": "Presence of the factor has no effect"
     },
     {
      "id": "c",
      "text": "Elimination of the factor reduces risk of the disease"
     },
     {
      "id": "d",
      "text": "The exposure to this factor should precede the development of the disease"
     }
    ],
    "answer": [
     "c",
     "d"
    ],
    "multi": true
   },
   {
    "id": "q25",
    "text": "An outbreak is best defined, if at all, from an epidemic on the basis of its being more:",
    "options": [
     {
      "id": "a",
      "text": "Sensitive"
     },
     {
      "id": "b",
      "text": "Common"
     },
     {
      "id": "c",
      "text": "Urgent"
     },
     {
      "id": "d",
      "text": "Localized"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q26",
    "text": "Which of the following measures is used frequently as a denominator to calculate the incidence rate of a disease?",
    "options": [
     {
      "id": "a",
      "text": "Number of cases observed"
     },
     {
      "id": "b",
      "text": "Number of new cases observed"
     },
     {
      "id": "c",
      "text": "Number of asymptomatic cases"
     },
     {
      "id": "d",
      "text": "Person-years of observation"
     }
    ],
    "answer": "d"
   },
   {
    "id": "q28",
    "text": "If rapidly progressive cancers are missed by a screening test, which type of bias will occur?",
    "options": [
     {
      "id": "a",
      "text": "Lead-time bias"
     },
     {
      "id": "b",
      "text": "Length bias"
     },
     {
      "id": "c",
      "text": "Selection bias"
     },
     {
      "id": "d",
      "text": "Surveillance bias"
     },
     {
      "id": "e",
      "text": "Information bias"
     }
    ],
    "answer": "b"
   }
  ]
 }
];

module.exports = { EXAMS };
