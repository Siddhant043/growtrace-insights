export type WhisperTraceContext = {
  jobId: string;
  videoId: string;
  workflowId: string;
  projectId: string;
};

export type TranscribeAudioParams = {
  audioBuffer: Buffer;
  traceContext?: WhisperTraceContext;
};
