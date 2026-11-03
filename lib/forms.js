'use strict';
// The program's official evaluation forms, one per requirement type.
// kind 'scale': every item is rated on the form's scale (N/A removes the item from the maximum when allowed);
//               score = sum of ratings / (number of rated items × top of scale) × 100.
// kind 'marks': each section gets marks up to its maximum; the maxima add up to 100.

const FORMS = {
 "cap": {
  "title": "Evaluation form for Critical Appraisal of a Paper (CAP)",
  "kind": "scale",
  "na": true,
  "scale": [
   [
    1,
    "Unsatisfactory / needs improvement"
   ],
   [
    2,
    "Marginal (approaching competence)"
   ],
   [
    3,
    "Satisfactory (competent)"
   ],
   [
    4,
    "Above average"
   ],
   [
    5,
    "Superior"
   ]
  ],
  "sections": [
   {
    "title": "Critical appraisal of the paper",
    "items": [
     {
      "t": "Demonstrated understanding of the problem studied"
     },
     {
      "t": "Identified pitfalls in research"
     },
     {
      "t": "Identified errors in reporting"
     },
     {
      "t": "Used evidence – based materials"
     },
     {
      "t": "Proposed corrective action for identified errors or weaknesses"
     },
     {
      "t": "Used appropriate checklist for appraisal"
     },
     {
      "t": "Appropriately answered relevant questions from peers"
     },
     {
      "t": "Responded confidently to Queries"
     }
    ]
   }
  ]
 },
 "cat": {
  "title": "Evaluation form for Critical Appraisal of a Topic (CAT)",
  "kind": "scale",
  "na": true,
  "scale": [
   [
    1,
    "Significant improvement required"
   ],
   [
    2,
    "Addressed, some improvement required"
   ],
   [
    3,
    "Satisfactorily addressed"
   ]
  ],
  "sections": [
   {
    "title": "Introduction",
    "items": [
     {
      "t": "Question was defined"
     },
     {
      "t": "Elements of PICO (Patient, Intervention, Comparator, Outcome) addressed"
     },
     {
      "t": "Rationale for choosing the topic was appropriate"
     }
    ]
   },
   {
    "title": "Methods – Literature Search",
    "items": [
     {
      "t": "Explicit inclusion/exclusion criteria"
     },
     {
      "t": "Comprehensive search, including major electronic sources utilized"
     },
     {
      "t": "Key words/Medical subject heading terms stated and used properly"
     },
     {
      "t": "Key studies selected for inclusion"
     }
    ]
   },
   {
    "title": "Analysis Of The Evidence – Internal Validity (Quality Of The Studies)",
    "items": [
     {
      "t": "Appraisal of included studies"
     },
     {
      "t": "Appropriate checklist tool used"
     },
     {
      "t": "Grading of studies was done"
     },
     {
      "t": "Comments on potential errors of studies were appropriate"
     },
     {
      "t": "Included papers and their appropriateness for question"
     },
     {
      "t": "Statistical analysis"
     },
     {
      "t": "Analyses made on subgroups"
     }
    ]
   },
   {
    "title": "Conclusion",
    "items": [
     {
      "t": "Question answered by included studies"
     },
     {
      "t": "Conclusion/ recommendation"
     },
     {
      "t": "Evidence in relation to the recommendation"
     },
     {
      "t": "Relevance of conclusion to local population"
     }
    ]
   }
  ],
  "question": "Was the topic selected in consultation with the supervisor?"
 },
 "proposal": {
  "title": "Research Proposal Evaluation Form",
  "kind": "scale",
  "na": true,
  "scale": [
   [
    1,
    "Unsatisfactory (No)"
   ],
   [
    2,
    "Incomplete / missing"
   ],
   [
    3,
    "Requires clarification"
   ],
   [
    4,
    "Satisfactory (Yes)"
   ]
  ],
  "sections": [
   {
    "title": "Research idea",
    "items": [
     {
      "t": "Proposed Research idea is Important"
     },
     {
      "t": "Proposed research is Deep (more than just a descriptive study)"
     },
     {
      "t": "Research idea in not exhausted in previous studies"
     }
    ]
   },
   {
    "title": "Title, objectives and rationale",
    "items": [
     {
      "t": "Attractive title reflecting content of the research"
     },
     {
      "t": "Proposed Research aim and objectives are clear"
     },
     {
      "t": "Proposed Research objectives are measurable"
     },
     {
      "t": "Proposed Research objectives are attainable"
     },
     {
      "t": "Proposed Research justification and rationale are valid"
     },
     {
      "t": "Proposed Expected benefits from the research are apparent"
     },
     {
      "t": "Role of the candidate in this proposal is crucial and fulfill the purpose of the training"
     }
    ]
   },
   {
    "title": "Research methodology",
    "items": [
     {
      "t": "Study type"
     },
     {
      "t": "Study population"
     },
     {
      "t": "Sample size"
     },
     {
      "t": "Sampling technique"
     },
     {
      "t": "Data collection methods"
     },
     {
      "t": "Analysis methods and programs"
     },
     {
      "t": "Research time frame is scientifically accepted"
     }
    ]
   },
   {
    "title": "Literature and ethics",
    "items": [
     {
      "t": "Literature review"
     },
     {
      "t": "Research ethics were observed in all steps of the conduct"
     }
    ]
   }
  ],
  "recommendation": [
   "Approve research proposal as submitted",
   "Approve with minor modifications (to be reviewed with the supervisor only)",
   "Reject the research proposal"
  ]
 },
 "ethics": {
  "title": "Evaluation form for Research Protocol Ethical Review Document",
  "kind": "scale",
  "na": false,
  "scale": [
   [
    1,
    "Poor"
   ],
   [
    2,
    "Below average"
   ],
   [
    3,
    "Average"
   ],
   [
    4,
    "Above average"
   ],
   [
    5,
    "Excellent"
   ]
  ],
  "sections": [
   {
    "title": "Ethical review",
    "items": [
     {
      "t": "Assessed the novelty and importance of research topic"
     },
     {
      "t": "Evaluated the transparency and feasibility of study objectives"
     },
     {
      "t": "Assessed the appropriateness of study design"
     },
     {
      "t": "Assessed the appropriateness of sample size and sampling methods"
     },
     {
      "t": "Ensured that inclusion and exclusion criteria are applicable"
     },
     {
      "t": "Reviewed rigorousness and applicability of the procedures for confidentiality and anonymity"
     },
     {
      "t": "Evaluated the procedure of obtaining informed consent for all participants"
     },
     {
      "t": "Determined whether the research involves physical or invasive interventions and, if so, the details of such interventions (e.g. collecting biological samples, cells, tissues)"
     },
     {
      "t": "Considered all possible risks of harm that might be posed by the research"
     },
     {
      "t": "Determined whether the research involves robust precautions to mitigate the potential for harm and deal with harm should it occur"
     },
     {
      "t": "Provided some weighing of the degree of risk of harm to the potential benefits of the research"
     },
     {
      "t": "Ensured that the research does not unfairly discriminate against certain individuals or groups"
     }
    ]
   }
  ]
 },
 "poster": {
  "title": "Research Poster Evaluation Form",
  "kind": "scale",
  "na": false,
  "scale": [
   [
    1,
    "Poor"
   ],
   [
    2,
    "Below average"
   ],
   [
    3,
    "Average"
   ],
   [
    4,
    "Above average"
   ],
   [
    5,
    "Excellent"
   ]
  ],
  "sections": [
   {
    "title": "Content",
    "items": [
     {
      "t": "Catchy title reflecting the content of poster"
     },
     {
      "t": "Research problem clearly stated"
     },
     {
      "t": "Context and importance of research demonstrated"
     },
     {
      "t": "Clear and concise materials and methods"
     },
     {
      "t": "Clear and not crowded text and tables"
     },
     {
      "t": "Results easily interpreted"
     },
     {
      "t": "Conclusions to point, and justified by results"
     },
     {
      "t": "Clear terms and sentences; jargon avoided"
     },
     {
      "t": "Grammar, spelling and punctuation"
     }
    ]
   },
   {
    "title": "Organisation And Display",
    "items": [
     {
      "t": "Overall appearance (balanced composition, catchy)"
     },
     {
      "t": "Colour aid for understanding, not distracting"
     },
     {
      "t": "Appropriate font (size, style, quality)"
     },
     {
      "t": "Highlighting of major concepts"
     },
     {
      "t": "Figures convey results effectively (simple, to point)"
     }
    ]
   },
   {
    "title": "Delivery",
    "items": [
     {
      "t": "Short clear presentation with a ‘take home message’"
     },
     {
      "t": "Effectiveness in answering questions"
     },
     {
      "t": "Comprehension and knowledge of subject area"
     },
     {
      "t": "Engagement with audience"
     },
     {
      "t": "Enthusiasm and confidence"
     },
     {
      "t": "Language and fluency"
     }
    ]
   }
  ]
 },
 "peer": {
  "title": "Evaluation form for Peer-review of manuscript/article",
  "kind": "scale",
  "na": true,
  "scale": [
   [
    1,
    "Absolutely insufficient"
   ],
   [
    2,
    "Great weaknesses"
   ],
   [
    3,
    "Small weaknesses"
   ],
   [
    4,
    "Good"
   ],
   [
    5,
    "Very good"
   ]
  ],
  "sections": [
   {
    "title": "Problem Statement, Conceptual Framework, and Research Question",
    "items": [
     {
      "t": "The introduction builds a logical case and provides context for the problem statement"
     },
     {
      "t": "The problem statement is clear and well-articulated"
     },
     {
      "t": "The conceptual framework is explicit and justified"
     },
     {
      "t": "The research purpose and/or question (as well as the research hypothesis, where applicable) is clearly stated."
     },
     {
      "t": "The hypotheses being investigated are clearly identified and presented"
     }
    ]
   },
   {
    "title": "Reference to the Literature and Documentation",
    "items": [
     {
      "t": "The literature review is comprehensive, relevant, and up-to-date"
     },
     {
      "t": "The literature is analyzed and critically appraised; gaps in the literature are identified as a basis for the study."
     }
    ]
   },
   {
    "title": "Relevance",
    "items": [
     {
      "t": "The study is relevant to the mission of the journal or its audience"
     },
     {
      "t": "The study addresses important problems or issues; the study is worth doing"
     },
     {
      "t": "For quantitative studies: the study has generalizability because of the selection of participants, setting, and educational intervention or materials"
     },
     {
      "t": "For qualitative studies: the study offers concepts or theories that are generalizable or transferable to other contexts, people, etc"
     }
    ]
   },
   {
    "title": "Research Design",
    "items": [
     {
      "t": "The research paradigm or approach is identified"
     },
     {
      "t": "The design is appropriate for the research purpose or question. If a mixed-methods approach is used, the rationale is provided for the relationship between and sequencing of quantitative and qualitative aspects of the study."
     },
     {
      "t": "For quantitative studies: the design has internal validity, and potential confounding variables or biases are addressed"
     },
     {
      "t": "For quantitative studies: the design has external validity, including participants, settings, and conditions"
     },
     {
      "t": "For qualitative studies: the study design incorporates techniques to ensure trustworthiness"
     },
     {
      "t": "For studies with interventions: the intervention is described in sufficient detail (objectives, activities, time allocation, training) to be able to assess the likelihood of the intervention having the desired effect and/or to permit the study to be replicated"
     },
     {
      "t": "The research methods are defined and clearly described, and they are sufficiently detailed to provide transparency or permit the study to be replicated"
     }
    ]
   },
   {
    "title": "Instrumentation, Data Collection, and Quality Control",
    "items": [
     {
      "t": "The development and content of the instrument(s)—as well as the preparation of observers, interviewers, and raters, as appropriate—are sufficiently described or referenced and are sufficiently detailed to permit transparency and/or replication"
     },
     {
      "t": "For qualitative studies: the characteristics of the researchers that may influence the research are described and accounted for during data collection"
     },
     {
      "t": "The measurement instrument is appropriate given the study’s variables; the scoring method is clearly defined"
     },
     {
      "t": "The psychometric properties and procedures are clearly presented and appropriate"
     },
     {
      "t": "The data set is sufficiently described or referenced."
     },
     {
      "t": "Data quality control is described and is adequate"
     }
    ]
   },
   {
    "title": "Population and Sample",
    "items": [
     {
      "t": "For quantitative studies: the population is defined in sufficient detail to permit the study to be replicated"
     },
     {
      "t": "The sampling procedures are described in sufficient detail to permit transparency, replication, or theory generation"
     },
     {
      "t": "Samples are appropriate to the research purpose or question"
     },
     {
      "t": "Selection bias is addressed"
     }
    ]
   },
   {
    "title": "Data Analysis and Statistics",
    "items": [
     {
      "t": "Data-analysis procedures are described in sufficient detail"
     },
     {
      "t": "Data-analysis procedures conform to the research design; hypotheses, models, or theory drives the data analyses."
     },
     {
      "t": "Statistical tests are appropriate"
     },
     {
      "t": "Topics such as effect size or functional significance, multiple tests or comparisons, and adjustment of significance level for chance outcomes were considered"
     },
     {
      "t": "Power issues are considered in studies that make statistical inferences"
     },
     {
      "t": "For qualitative analysis: how members of the research team contributed to coding, identifying themes, and/or drawing inferences is described; methods used to ensure trustworthiness of the analysis are also described."
     }
    ]
   },
   {
    "title": "Presentation of Results",
    "items": [
     {
      "t": "All results are presented. The results align with the methods and study questions"
     },
     {
      "t": "The amount of data presented is sufficient, balanced, accurate, and supportive of inferences or themes."
     },
     {
      "t": "Tables, graphs, or figures are used judiciously and agree with the text."
     },
     {
      "t": "The statistics are reported correctly and appropriately"
     }
    ]
   },
   {
    "title": "Discussion and Conclusion—Interpretation",
    "items": [
     {
      "t": "The conclusions are clearly stated; key points stand out"
     },
     {
      "t": "The conclusions follow from the design, methods, and results"
     },
     {
      "t": "The study limitations are discussed"
     },
     {
      "t": "Findings are placed in the context of relevant literature, and alternative interpretations are considered as needed."
     },
     {
      "t": "Practical significance or theoretical implications are discussed; guidance for future studies is offered."
     }
    ]
   },
   {
    "title": "Title, Authors, and Abstract",
    "items": [
     {
      "t": "The title is clear, informative, and representative of the content"
     },
     {
      "t": "The abstract contains essential details"
     },
     {
      "t": "The conclusions in the abstract are justified by the information in the abstract and the text"
     },
     {
      "t": "There are no inconsistencies in detail among the abstract, text, tables, and figures"
     },
     {
      "t": "All the information in the abstract is present in the text"
     }
    ]
   },
   {
    "title": "Presentation and Documentation",
    "items": [
     {
      "t": "The text is well written and easy to follow"
     },
     {
      "t": "The manuscript is well organized"
     }
    ]
   },
   {
    "title": "Scientific Conduct",
    "items": [
     {
      "t": "Ideas and materials of other authors are correctly attributed. (There are no instances of plagiarism)."
     },
     {
      "t": "Prior publication by the author(s) of substantial portions of the data or study is appropriately acknowledged."
     },
     {
      "t": "Any apparent conflict of interest is appropriately disclosed"
     },
     {
      "t": "There is an explicit statement of ethical review and approval (e.g., by an institutional review board [IRB]) for studies directly involving human subjects or data about them"
     }
    ]
   }
  ],
  "note": "Supervisor’s evaluation of the resident’s review of each item. Adapted from Review Criteria for Research Manuscripts (2nd ed.)."
 },
 "program": {
  "title": "Program plan evaluation report",
  "kind": "marks",
  "sections": [
   {
    "title": "Title",
    "max": 5,
    "guide": [
     "Descriptive, informative, precise and reflecting the scope of the program."
    ]
   },
   {
    "title": "Statement of goals",
    "max": 10,
    "guide": [
     "Broad statements that define what the health program is expected to accomplish."
    ]
   },
   {
    "title": "Targets",
    "max": 15,
    "guide": [
     "Specific statements of activities and outcomes needed to reach the goal, including a time frame and a single result or end product."
    ]
   },
   {
    "title": "Strategies and activities",
    "max": 25,
    "guide": [
     "The means through which the changes will be made: strategies identify the vehicle for change; activities describe the specific things that will be done."
    ]
   },
   {
    "title": "Resources and constraints",
    "max": 15,
    "guide": [
     "Specific resources in the target community that may be used for the program, and constraints expected to work against it."
    ]
   },
   {
    "title": "Implementation plan",
    "max": 20,
    "guide": [
     "Procedures for introducing the program to the target group."
    ]
   },
   {
    "title": "Monitoring and evaluation plan",
    "max": 10,
    "guide": [
     "Procedures for collecting and analysing information to determine program performance."
    ]
   }
  ]
 },
 "ic": {
  "title": "Evaluation form for Infection control report",
  "kind": "marks",
  "sections": [
   {
    "title": "Title",
    "max": 5,
    "guide": [
     "Descriptive, informative, precise and reflecting the scope of the report."
    ]
   },
   {
    "title": "Summary",
    "max": 10,
    "guide": [
     "Executive summary of the most important information: purpose, problem addressed, methods and recommendations."
    ]
   },
   {
    "title": "Background",
    "max": 20,
    "guide": [
     "Identification of infectious disease processes (colonization vs infection vs contamination; reservoirs, incubation, communicability, transmission; lab interpretation; significant organisms; antimicrobial use).",
     "Surveillance and epidemiologic investigation (design of surveillance, data collection and compilation, outbreak investigation).",
     "Future-oriented technical domain (electronic surveillance, databases, algorithmic detection, clinical decision support, IPC in the electronic health record)."
    ]
   },
   {
    "title": "Solution — preventing/controlling transmission",
    "max": 20,
    "guide": [
     "Develop and review IPC policies and procedures; collaborate with public health on community responses; implement IPC strategies (hand hygiene, cleaning/disinfection/sterilization, isolation precautions, devices and procedures, patient placement, immunization, construction, influx of communicable diseases)."
    ]
   },
   {
    "title": "Conclusions",
    "max": 15,
    "guide": [
     "Summarizes the main arguments and makes a final, firm case for the solution."
    ]
   },
   {
    "title": "Recommendations and supporting reasons",
    "max": 20,
    "guide": [
     "Infection prevention and control: feasible, evidence-based, a reasonable solution to the specific problem.",
     "Management and communication: planning, communication and feedback, quality/performance improvement and patient safety."
    ]
   },
   {
    "title": "List of references",
    "max": 5,
    "guide": [
     "Well cited, complete, accurate, properly formatted, recent and related."
    ]
   },
   {
    "title": "Appendices and supplementary material",
    "max": 5,
    "guide": [
     "Additional information (e.g. surveys/interviews) that is important but does not fit within the text."
    ]
   }
  ]
 },
 "outbreak": {
  "title": "Outbreak Project Evaluation Form",
  "kind": "marks",
  "sections": [
   {
    "title": "Abstract",
    "max": 5,
    "guide": [
     "Title: Compose a title that includes the name of the health condition, population, time and place.",
     "Structured summary: Use a structured format for the abstract with the following section headings: Background, Objective, Methods, Outcome(results) and Conclusions."
    ]
   },
   {
    "title": "Introduction",
    "max": 15,
    "guide": [
     "Context: Setting: Describe the setting (community, hospital, etc.) where the outbreak occurred. Identification: Describe the events that led to the discovery of the index case of the outbreak. Background: Provide the scientific context (e.g., describe the organism and whether it is emerging, epidemic, endemic etc.). Rationale: Identify the clinical and public health rationale to report outbreak (e.g., need for heightened awareness, demonstration of a new investigation or intervention technique). Objective: Articulate the objective of the outbreak report. (e.g., “The objective of this report is to describe the epidemiological, diagnostic and genetic investigation of the outbreak that occurred in --)."
    ]
   },
   {
    "title": "Methods",
    "max": 25,
    "guide": [
     "Overview: Identify the start and finish dates of the outbreak and the date the investigations began. Describe how the end date was determined including the incubation period and date of the last reported case.",
     "Case finding and data collection: Provide the case definitions (including confirmed, probable and under investigation if applicable). Describe data collection activities (for person, time and place) including any questionnaire development (clinical history, risk factor assessment).",
     "Investigations: Provide a systematic description of how the outbreak was investigated including Laboratory investigations, and Environmental sampling.",
     "Epidemiologic and statistical analyses: Describe any analytical methods used assess the outbreak (e.g., risk factor analysis, survival analysis, estimation of background rates). Reference any complex analytical methods used (e.g., social network analysis, estimation of R0). Include any sub-group analyses, what was done to control for interactions and confounding factors and how missing data and reporting delays were addressed.",
     "Interventions: Describe the clinical and public health measures that were put in place to control the outbreak including as applicable including Exposure history, Health risk assessment, Clinical treatments, and Public health measures (e.g., quarantine, contact tracing, surveillance, immunization clinics, risk communications etc.)."
    ]
   },
   {
    "title": "Results",
    "max": 20,
    "guide": [
     "Descriptive epidemiology: Provide an overview of what happened by person, time and place.",
     "Ancillary analyses: Provide subgroup analyses and describe the assessment of interactions and confounders as indicated.",
     "Complications: Identify any complications, such as hospitalizations and deaths.",
     "Epidemic curve: Provide a figure showing the epidemic curve. In the title include the disease, population/place and time (year).",
     "Frequency tables: Include a table with demographic characteristics (e.g., age and sex) and symptom frequency, if applicable."
    ]
   },
   {
    "title": "Discussion",
    "max": 20,
    "guide": [
     "Key results: Summarize key findings that relate to the report objective, highlighting the new or important aspects of the outbreak and their significance.",
     "Comparison: Consider these findings in relation to the current literature.",
     "Strengths and weaknesses: Identify strengths and weaknesses of the outbreak investigation and response.",
     "Interpretation and generalizability: Ensure conclusions address objective and follow from the results."
    ]
   },
   {
    "title": "Conclusion",
    "max": 5,
    "guide": [
     "Conclusion: Ensure conclusions address objective and follow from the results."
    ]
   },
   {
    "title": "References & appendices",
    "max": 5,
    "guide": []
   },
   {
    "title": "General layout (grammar, spelling, punctuation, font, tables, graphs)",
    "max": 5,
    "guide": []
   }
  ]
 },
 "survrep": {
  "title": "Surveillance report checklist (adapted from CCDR)",
  "kind": "marks",
  "sections": [
   {
    "title": "Abstract",
    "max": 10,
    "guide": [
     "Title: Compose a title that includes the name of the health condition, population, time and place.",
     "Structured summary: Provide a structured abstract including the following sub-headings: Background; Objectives; Methods; Results; and Conclusions."
    ]
   },
   {
    "title": "Introduction",
    "max": 10,
    "guide": [
     "Context: Summarize the current situation regarding the health condition under surveillance and identify why it is important.",
     "Objectives: State the objective of the surveillance report."
    ]
   },
   {
    "title": "Methods",
    "max": 20,
    "guide": [
     "Setting: Describe the setting, locations and dates of the surveillance period.",
     "Population: Describe the population under surveillance.",
     "Definitions: Provide definitions for each health event under surveillance, including case definitions and any public health interventions.",
     "Information sources: Describe all data sources, including the objective of any surveillance systems, what data were collected and how data were gathered, transferred and stored.",
     "Supplementary data: If appropriate, note where to access supplemental material (e.g., www.moh.gov.sa).",
     "Data quality, missing data and reporting delays.: Describe how the data quality was assessed. Explain how missing data were addressed. If data is reported by date of diagnosis or symptom onset, include a statement about whether the data for the most recent periods may be revised.",
     "Data analysis: Describe any analytical methods used."
    ]
   },
   {
    "title": "Results",
    "max": 25,
    "guide": [
     "Descriptive data: Provide a summary of the descriptive data, including demographics.",
     "Data Quality: Report on data quality (e.g., completeness, missing data, under reporting,)",
     "Analytic data: Provide a summary of the analysis including (when indicated) estimates of trends.",
     "Figures: Create the minimum number of figures to highlight key results. Create a title that includes person, time and place."
    ]
   },
   {
    "title": "Discussion",
    "max": 25,
    "guide": [
     "Key results: Summarize key results with reference to surveillance objectives",
     "Comparison: Consider these findings in relation to the current literature.",
     "Strengths and weaknesses: Discuss strengths and weaknesses of the study (data quality, completeness, sources of potential bias).",
     "Interpretation and generalizability: Provide a cautious overall interpretation of results considering objectives, limitations, multiplicity of analyses, results from similar studies and other relevant evidence."
    ]
   },
   {
    "title": "Conclusion",
    "max": 5,
    "guide": [
     "Conclusion: Ensure conclusions address objective and follow from the results."
    ]
   },
   {
    "title": "References & appendices attached",
    "max": 5,
    "guide": []
   }
  ]
 }
};

// Score out of 100 from an evaluator's responses. Throws a message when something is missing or out of range.
function scoreForm(form, responses) {
  const r = responses || {};
  if (form.kind === 'marks') {
    let sum = 0;
    form.sections.forEach((s, si) => {
      const v = Number(r['s' + si]);
      if (r['s' + si] === undefined || r['s' + si] === '' || !Number.isFinite(v) || v < 0 || v > s.max) throw new Error(`Enter marks between 0 and ${s.max} for “${s.title}”`);
      sum += v;
    });
    return Math.round(sum * 10) / 10;
  }
  const top = Math.max(...form.scale.map((x) => x[0])), allowed = new Set(form.scale.map((x) => x[0]));
  let sum = 0, rated = 0;
  form.sections.forEach((s, si) => s.items.forEach((it, ii) => {
    const v = r[`s${si}i${ii}`];
    if (v === 'na' && form.na) return;
    if (!allowed.has(Number(v))) throw new Error(`Rate every item (missing: “${it.t.slice(0, 60)}”)`);
    sum += Number(v); rated++;
  }));
  if (!rated) throw new Error('At least one item must be rated');
  return Math.round((sum / (rated * top)) * 1000) / 10;
}

const formFor = (r) => (r && !r.formOff ? FORMS[r.type] || null : null);

module.exports = { FORMS, scoreForm, formFor };
