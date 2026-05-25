export type OpenAiTtsTraceContext = {
  jobId: string;
  videoId: string;
  workflowId: string;
  projectId: string;
};

export type SynthesizeSpeechParams = {
  text: string;
  traceContext?: OpenAiTtsTraceContext;
};
