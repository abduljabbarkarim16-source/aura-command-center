export interface Incident {
  id: string;
  type: 'hallucinated-success' | 'tool-dispatch-failed' | 'type-safety-bypass' | 'other';
  severity: 'warn' | 'error';
  message: string;
  context: any;
  timestamp: string;
}

class IncidentServiceImpl {
  private incidents: Incident[] = [];
  private listeners = new Set<(incidents: Incident[]) => void>();

  subscribe(fn: (incidents: Incident[]) => void) {
    this.listeners.add(fn);
    fn([...this.incidents]);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn([...this.incidents]);
  }

  createIncident(params: Omit<Incident, 'id' | 'timestamp'>) {
    const incident: Incident = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...params
    };
    this.incidents = [incident, ...this.incidents].slice(0, 100);
    this.notify();
    return incident;
  }
  
  getIncidents() {
    return [...this.incidents];
  }
  
  clear() {
    this.incidents = [];
    this.notify();
  }
}

export const incidentService = new IncidentServiceImpl();
