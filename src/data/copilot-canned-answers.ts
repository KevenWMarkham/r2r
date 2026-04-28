export interface CannedAnswer {
  match: RegExp;
  reply: string;
}

export const cannedAnswers: CannedAnswer[] = [
  {
    match: /close\s*status|where are we|current phase/i,
    reply:
      "NA close is in Phase 2 (Execute), Day 3 of 6. 847 accounts reconciled, 12 exceptions above materiality pending review. Predicted completion: end of Day 6.",
  },
  {
    match: /exceptions|recon/i,
    reply:
      "12 exceptions above $500K materiality — top 3: GL 4211 ($1.2M variance), GL 6831 ($890K variance), GL 2114 ($670K variance). Two have proposed adjusting entries waiting on the SG&A Manager's approval.",
  },
  {
    match: /contract/i,
    reply:
      "34 contracts > $1M this period; 8 flagged for manager review. Top risks: Contract_4 (Construction Retail Remodel, ASC 842 lease exposure) and Contract_5 (AWS Enterprise, auto-renewal). See the Contracts tab for the risk-ranked queue.",
  },
  {
    match: /accrual/i,
    reply:
      "Proposed accruals total $14.2M this period. 23 auto-calculated with confidence >0.8. 4 are awaiting the Senior Accountant's submission — open the AccrualProposal view for each to see the calc detail and approve.",
  },
  {
    match: /entity|entities|region/i,
    reply:
      "6 entities in scope: NA, EMEA, Greater China, APLA, Corporate, Global. NA is leading — currently in Execute phase. EMEA starts Pre-Close tomorrow. Greater China and APLA are queued. Corporate and Global follow at consolidation.",
  },
  {
    match: /variance|commentary|reporting/i,
    reply:
      "Variance commentary is available on the Narrative tab. I can draft line-item commentary for material P&L variances, or an executive close summary for the board. Click 'Generate' on any P&L line.",
  },
  {
    match: /.*/,
    reply:
      "I can help with close status, exceptions, contracts, entities, accruals, variance commentary, and executive summaries. What do you need?",
  },
];
