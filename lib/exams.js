'use strict';
// Exams seeded into the database on first start. Correct answers stay on the server.
// T1: R1 epidemiology course exam (2026–27). Correct answers are those marked in red in the source file.

const EXAMS = [
 {
  "id": "t1",
  "title": "T1 Exam — Biostatistics & Epidemiology (R1)",
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
    "id": "b1",
    "part": "bio",
    "text": "A large prospective cohort study is conducted to investigate the association between regular physical activity and the risk of developing type 2 diabetes mellitus. Previous smaller studies have suggested that regular physical activity may reduce the risk of diabetes. What is the probability that the study will detect a statistically significant association if regular physical activity truly affects the risk of developing diabetes?",
    "options": [
     {
      "id": "a",
      "text": "Type I error (α)"
     },
     {
      "id": "b",
      "text": "Type II error (β)"
     },
     {
      "id": "c",
      "text": "Statistical power (1 − β)"
     },
     {
      "id": "d",
      "text": "Significance level (p-value)"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b2",
    "part": "bio",
    "text": "A clinical study is conducted to evaluate the effectiveness of a new treatment for patients with rheumatoid arthritis. Among 12 patients receiving the new treatment, 9 demonstrate significant clinical improvement after six months. In comparison, among 18 patients receiving conventional treatment, 7 demonstrate clinical improvement during the same follow-up period. Which of the following statistical tests is most appropriate for comparing the treatment outcomes between the two groups?",
    "options": [
     {
      "id": "a",
      "text": "Independent samples t-test"
     },
     {
      "id": "b",
      "text": "Paired t-test"
     },
     {
      "id": "c",
      "text": "Chi-square test"
     },
     {
      "id": "d",
      "text": "Fisher's exact test"
     }
    ],
    "answer": "d"
   },
   {
    "id": "b3",
    "part": "bio",
    "text": "A cross-sectional study investigates the relationship between body mass index (BMI) and serum HDL cholesterol levels among 350 adults. The investigators report a Pearson correlation coefficient of r = −0.52, with a p-value of 0.002. Which of the following is the best interpretation of these findings?",
    "options": [
     {
      "id": "a",
      "text": "Higher BMI causes a reduction in HDL cholesterol levels."
     },
     {
      "id": "b",
      "text": "There is no statistically significant association between BMI and HDL cholesterol levels."
     },
     {
      "id": "c",
      "text": "As BMI increases, HDL cholesterol levels tend to decrease."
     },
     {
      "id": "d",
      "text": "The correlation indicates a strong positive relationship between BMI and HDL cholesterol levels."
     }
    ],
    "answer": "c"
   },
   {
    "id": "b4",
    "part": "bio",
    "text": "A patient admitted to the intensive care unit (ICU) with septic shock undergoes continuous hemodynamic monitoring. During the first hour, the following mean arterial pressure (MAP) readings are recorded: 65, 72, 68, 80, 75, and 70 mmHg. What is the median of the recorded MAP values?",
    "options": [
     {
      "id": "a",
      "text": "68 mmHg"
     },
     {
      "id": "b",
      "text": "69 mmHg"
     },
     {
      "id": "c",
      "text": "71 mmHg"
     },
     {
      "id": "d",
      "text": "72 mmHg"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b5",
    "part": "bio",
    "text": "A researcher conducts a cross-sectional study to determine the prevalence of smoking among healthcare workers. Participants are classified into four occupational categories: physician, nurses, pharmacists, and technicians. The researcher wants to compare the percentage of smokers across these categories. Which of the following graphs is most appropriate for presenting these data?",
    "options": [
     {
      "id": "a",
      "text": "Histogram"
     },
     {
      "id": "b",
      "text": "Bar chart"
     },
     {
      "id": "c",
      "text": "Scatter plot"
     },
     {
      "id": "d",
      "text": "Line graph"
     }
    ],
    "answer": "b"
   },
   {
    "id": "b6",
    "part": "bio",
    "text": "A researcher collects body mass index (BMI) measurements from 500 adults attending a primary healthcare center. The researcher wants to examine the frequency distribution and shape of the BMI measurements. Which of the following graphs is most appropriate?",
    "options": [
     {
      "id": "a",
      "text": "Pie chart"
     },
     {
      "id": "b",
      "text": "Bar chart"
     },
     {
      "id": "c",
      "text": "Histogram"
     },
     {
      "id": "d",
      "text": "Scatter plot"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b7",
    "part": "bio",
    "text": "A researcher investigates the relationship between age and systolic blood pressure among 300 adults. Both variables are measured numerically, and the investigator wants to visualize their association. Which of the following graphs is most appropriate?",
    "options": [
     {
      "id": "a",
      "text": "Bar chart"
     },
     {
      "id": "b",
      "text": "Pie chart"
     },
     {
      "id": "c",
      "text": "Scatter plot"
     },
     {
      "id": "d",
      "text": "Histogram"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b8",
    "part": "bio",
    "text": "A cross-sectional study estimates the prevalence of hypertension among adults attending primary healthcare centers. The prevalence is 30%, with a 95% confidence interval (CI) of 26%–34%. Which of the following is the most appropriate interpretation of this confidence interval?",
    "options": [
     {
      "id": "a",
      "text": "There is a 95% probability that the true population prevalence lies between 26% and 34%."
     },
     {
      "id": "b",
      "text": "Approximately 95% of individuals in the study have a prevalence between 26% and 34%."
     },
     {
      "id": "c",
      "text": "If the study were repeated many times, approximately 95% of the confidence intervals constructed using the same method would contain the true population prevalence."
     },
     {
      "id": "d",
      "text": "The prevalence of hypertension is exactly 30% in the population."
     }
    ],
    "answer": "c"
   },
   {
    "id": "b9",
    "part": "bio",
    "text": "Two independent studies estimate the prevalence of diabetes mellitus in the same population using similar sampling methods. Study A includes 150 participants, whereas Study B includes 1,500 participants. Assuming similar prevalence estimates and variability, which of the following is most likely?",
    "options": [
     {
      "id": "a",
      "text": "Study A will have a narrower confidence interval."
     },
     {
      "id": "b",
      "text": "Study B will have a narrower confidence interval."
     },
     {
      "id": "c",
      "text": "Both studies will have identical confidence intervals."
     },
     {
      "id": "d",
      "text": "Increasing sample size will increase the margin of error."
     }
    ],
    "answer": "b"
   },
   {
    "id": "b10",
    "part": "bio",
    "text": "A researcher measures the mean systolic blood pressure among 100 adults. The sample mean is 120 mmHg, and the standard deviation is 20 mmHg. Assuming a normal approximation and using a critical value of 1.96, what is the approximate 95% confidence interval for the population mean?",
    "options": [
     {
      "id": "a",
      "text": "100–140 mmHg"
     },
     {
      "id": "b",
      "text": "116–123 mmHg"
     },
     {
      "id": "c",
      "text": "118–122 mmHg"
     },
     {
      "id": "d",
      "text": "110–130 mmHg"
     }
    ],
    "answer": "b",
    "keyNote": "Exact interval is 116.1–123.9 mmHg (120 ± 1.96 × 20/√100); “116–123” is the closest option."
   },
   {
    "id": "b11",
    "part": "bio",
    "text": "A matched case-control study is conducted to investigate the association between smoking and lung cancer. Investigators recruit 100 patients with lung cancer and match each case to one control of the same age and sex. The smoking status of each matched pair is summarized in the table. What is the matched odds ratio for the association between smoking and lung cancer?",
    "options": [
     {
      "id": "a",
      "text": "2.0"
     },
     {
      "id": "b",
      "text": "3.0"
     },
     {
      "id": "c",
      "text": "4.0"
     },
     {
      "id": "d",
      "text": "6.0"
     }
    ],
    "answer": "c",
    "table": {
     "head": [
      "",
      "Control exposed",
      "Control unexposed"
     ],
     "rows": [
      [
       "Case exposed",
       "30",
       "40"
      ],
      [
       "Case unexposed",
       "10",
       "20"
      ]
     ]
    }
   },
   {
    "id": "b12",
    "part": "bio",
    "text": "A clinical researcher investigates the effectiveness of a health education program in improving patients' knowledge about diabetes mellitus. Knowledge scores are measured among 40 patients before and after the educational intervention. The Shapiro–Wilk test indicates that the distribution of paired score differences is significant (p < 0.05). Which of the following statistical tests is most appropriate for comparing the knowledge scores before and after the intervention?",
    "options": [
     {
      "id": "a",
      "text": "Independent samples t-test"
     },
     {
      "id": "b",
      "text": "Paired samples t-test"
     },
     {
      "id": "c",
      "text": "Mann–Whitney U test"
     },
     {
      "id": "d",
      "text": "Wilcoxon signed-rank test"
     }
    ],
    "answer": "d"
   },
   {
    "id": "b13",
    "part": "bio",
    "text": "A researcher compares patient satisfaction scores, measured on a five-point ordinal scale, among patients attending three different primary healthcare centers. The three groups consist of independent participants. Which statistical test is most appropriate?",
    "options": [
     {
      "id": "a",
      "text": "One-way ANOVA"
     },
     {
      "id": "b",
      "text": "Kruskal–Wallis H test"
     },
     {
      "id": "c",
      "text": "Friedman test"
     },
     {
      "id": "d",
      "text": "Paired t-test"
     }
    ],
    "answer": "b"
   },
   {
    "id": "b14",
    "part": "bio",
    "text": "A researcher investigates the association between night-shift work and sleep duration among healthcare workers. The mean sleep duration is measured in 60 nurses working night shifts and 60 different nurses working day shifts. Sleep duration is approximately normally distributed in both groups Which statistical test is most appropriate for comparing the mean sleep duration between the two groups?",
    "options": [
     {
      "id": "a",
      "text": "Paired samples t-test"
     },
     {
      "id": "b",
      "text": "Independent samples t-test"
     },
     {
      "id": "c",
      "text": "One-way ANOVA"
     },
     {
      "id": "d",
      "text": "Chi-square test"
     }
    ],
    "answer": "b"
   },
   {
    "id": "b15",
    "part": "bio",
    "text": "A researcher investigates whether mean systolic blood pressure differs among adults classified into three independent groups according to their physical activity levels: low, moderate, and high. The blood pressure measurements are approximately normally distributed within each group, and group variances are similar. Which statistical test is most appropriate?",
    "options": [
     {
      "id": "a",
      "text": "Independent samples t-test"
     },
     {
      "id": "b",
      "text": "Paired samples t-test"
     },
     {
      "id": "c",
      "text": "One-way ANOVA"
     },
     {
      "id": "d",
      "text": "Pearson correlation"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b16",
    "part": "bio",
    "text": "A researcher compares mean HbA1c levels among patients receiving three different diabetes treatments. A one-way ANOVA produces an F-statistic of 6.8 and a p-value of 0.003. All relevant assumptions are satisfied. Which of the following is the most appropriate interpretation?",
    "options": [
     {
      "id": "a",
      "text": "All three treatment groups have significantly different mean HbA1c levels."
     },
     {
      "id": "b",
      "text": "At least one treatment group has a mean HbA1c level that differs significantly from another group."
     },
     {
      "id": "c",
      "text": "The three groups have identical mean HbA1c levels."
     },
     {
      "id": "d",
      "text": "The first treatment is significantly more effective than the other two treatments"
     }
    ],
    "answer": "b"
   },
   {
    "id": "b17",
    "part": "bio",
    "text": "A cross-sectional study investigates the association between smoking status and hypertension among 400 adults. Participants are classified as smokers or non smokers and as hypertensive or non-hypertensive. All expected cell frequencies are greater than 5. Which of the following statistical tests is most appropriate for analyzing the association between these variables?",
    "options": [
     {
      "id": "a",
      "text": "Independent samples t-test"
     },
     {
      "id": "b",
      "text": "Pearson Chi-square test"
     },
     {
      "id": "c",
      "text": "Paired samples t-test"
     },
     {
      "id": "d",
      "text": "Pearson correlation coefficient"
     }
    ],
    "answer": "b"
   },
   {
    "id": "b18",
    "part": "bio",
    "text": "A researcher examines the association between obesity status (obese versus non-obese) and physical activity level (low, moderate, or high) among 500 adults. A Chi-square test yields χ² = 12.5 and p = 0.002. Which of the following is the most appropriate interpretation?",
    "options": [
     {
      "id": "a",
      "text": "Obesity causes reduced physical activity."
     },
     {
      "id": "b",
      "text": "There is a statistically significant association between obesity status and physical activity level."
     },
     {
      "id": "c",
      "text": "There is no statistically significant association between the two variables."
     },
     {
      "id": "d",
      "text": "The Chi-square result indicates the strength and direction of the association."
     }
    ],
    "answer": "b"
   },
   {
    "id": "b19",
    "part": "bio",
    "text": "A researcher wants to compare the variability of two clinical measurements among adult patients. Body weight is measured in kilograms (kg), while height is measured in centimeters (cm). The mean weight is 75 kg with a standard deviation of 12 kg, and the mean height is 170 cm with a standard deviation of 17 cm. Which of the following statistical measures is most appropriate for comparing the relative variability of these two measurements?",
    "options": [
     {
      "id": "a",
      "text": "Standard deviation"
     },
     {
      "id": "b",
      "text": "Variance"
     },
     {
      "id": "c",
      "text": "Coefficient of variation"
     },
     {
      "id": "d",
      "text": "Interquartile range"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b20",
    "part": "bio",
    "text": "A researcher investigates the length of hospital stay among 200 patients admitted to a tertiary care hospital. Most patients are discharged within 3–7 days, while a small number remain hospitalized for more than 60 days, resulting in a highly right-skewed distribution. Which of the following measures of central tendency is most appropriate for describing the typical length of hospital stay?",
    "options": [
     {
      "id": "a",
      "text": "Arithmetic mean"
     },
     {
      "id": "b",
      "text": "Median"
     },
     {
      "id": "c",
      "text": "Mode"
     },
     {
      "id": "d",
      "text": "Geometric mean"
     }
    ],
    "answer": "b"
   },
   {
    "id": "b21",
    "part": "bio",
    "text": "A researcher measures systolic blood pressure among 100 adult patients attending a primary healthcare center. The calculated variance of systolic blood pressure is 144 mmHg². Which of the following statements correctly describes the relationship between variance and standard deviation?",
    "options": [
     {
      "id": "a",
      "text": "Standard deviation is the square of the variance."
     },
     {
      "id": "b",
      "text": "Standard deviation is the square root of the variance."
     },
     {
      "id": "c",
      "text": "Variance and standard deviation are always equal."
     },
     {
      "id": "d",
      "text": "Standard deviation is twice the variance."
     }
    ],
    "answer": "b"
   },
   {
    "id": "b22",
    "part": "bio",
    "text": "A researcher conducts a randomized controlled trial to compare the effectiveness of a new antihypertensive medication with standard treatment. The primary outcome is mean systolic blood pressure after 12 weeks. The investigator wants to determine whether there is a difference in mean systolic blood pressure between the two groups. Which of the following correctly represents the null and alternative hypotheses?",
    "options": [
     {
      "id": "a",
      "text": "H₀: μ₁ = μ₂ ; H₁: μ₁ ≠ μ₂"
     },
     {
      "id": "b",
      "text": "H₀: μ₁ > μ₂ ; H₁: μ₁ < μ₂"
     },
     {
      "id": "c",
      "text": "H₀: μ₁ < μ₂ ; H₁: μ₁ > μ₂"
     },
     {
      "id": "d",
      "text": "H₀: μ₁ = μ₂ ; H₁: μ₁ > μ₂"
     }
    ],
    "answer": "a",
    "keyNote": "The source file is missing the “≠” sign in option A; restored as H₁: μ₁ ≠ μ₂."
   },
   {
    "id": "b23",
    "part": "bio",
    "text": "A researcher conducts a study to evaluate the effectiveness of a health education program in improving influenza vaccination uptake among 200 healthcare workers. Vaccination status (vaccinated or unvaccinated) is recorded for each participant before and three months after the intervention. The investigator wants to determine whether the proportion of vaccinated healthcare workers changed significantly following the educational program. Which of the following statistical tests is most appropriate?",
    "options": [
     {
      "id": "a",
      "text": "Pearson Chi-square test"
     },
     {
      "id": "b",
      "text": "Fisher's exact test"
     },
     {
      "id": "c",
      "text": "McNemar's test"
     },
     {
      "id": "d",
      "text": "Paired samples t-test"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b24",
    "part": "bio",
    "text": "A researcher conducts a study to compare the mean body mass index (BMI) among healthcare workers in three different departments: Intensive Care Unit (ICU), Emergency Department, and Outpatient Clinics. A total of 150 healthcare workers are randomly selected, with 50 participants from each department. BMI is approximately normally distributed within each group, and the variances are equal. Which of the following statistical tests is most appropriate to determine whether the mean BMI differs significantly among the three departments?",
    "options": [
     {
      "id": "a",
      "text": "Paired samples t-test"
     },
     {
      "id": "b",
      "text": "Independent samples t-test"
     },
     {
      "id": "c",
      "text": "One-way ANOVA"
     },
     {
      "id": "d",
      "text": "Chi-square test"
     }
    ],
    "answer": "c"
   },
   {
    "id": "b25",
    "part": "bio",
    "text": "A researcher aims to compare the mean systolic blood pressure among patients receiving three different antihypertensive medications. Before applying one-way ANOVA, the researcher wants to assess whether the data satisfy the normality assumption. Which of the following statistical tests is most appropriate for assessing normality?",
    "options": [
     {
      "id": "a",
      "text": "Chi-square test"
     },
     {
      "id": "b",
      "text": "Shapiro–Wilk test"
     },
     {
      "id": "c",
      "text": "Levene’s test"
     },
     {
      "id": "d",
      "text": "Pearson correlation test"
     }
    ],
    "answer": "b"
   },
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
    "answer": "a",
    "part": "epi"
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
    },
    "part": "epi"
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
    "answer": "a",
    "part": "epi"
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
    "keyNote": "Check the question: “Is considered loose or broad” is also not true of a specific case definition.",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "answer": "c",
    "part": "epi"
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
    "answer": "a",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "answer": "b",
    "part": "epi"
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
    "answer": "a",
    "part": "epi"
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
    "answer": "a",
    "part": "epi"
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
    "answer": "b",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "answer": "c",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "group": "lab",
    "part": "epi"
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
    "group": "lab",
    "part": "epi"
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
    "group": "lab",
    "part": "epi"
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
    "answer": "c",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "multi": true,
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "answer": "d",
    "part": "epi"
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
    "answer": "b",
    "part": "epi"
   }
  ],
  "parts": [
   {
    "id": "bio",
    "title": "Part 1 — Biostatistics"
   },
   {
    "id": "epi",
    "title": "Part 2 — Epidemiology"
   }
  ]
 }
];

module.exports = { EXAMS };
