import React from 'react';
import { Breadcrumb } from '../../components/common/Breadcrumb';

export const AIMonitoringPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: 'AI System Monitoring' }]} />
      <div className="p-6 bg-surface border rounded-xl space-y-2">
        <h1 className="text-xl font-extrabold font-heading">AI monitoring</h1>
        <p className="text-xs text-foreground-muted">
          Live LLM telemetry (accuracy, latency, token throughput) is not configured. Provider status is available only from case-scoped AI responses and backend `AI_PROVIDER` configuration.
        </p>
      </div>
    </div>
  );
};
