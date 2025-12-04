/**
 * API client for SIGMENT backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface NoteCreate {
  content_raw: string;
  user_id: string;
}

export interface NoteSync {
  notes: NoteCreate[];
}

export interface NoteResponse {
  id: string;
  user_id: string;
  content_raw: string;
  content_clarified?: string;
  pillar_id?: string;
  cluster_id?: string;
  ai_relevance_score?: number;
  status: string;
  created_at: string;
  processed_at?: string;
}

class APIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  async createNote(note: NoteCreate): Promise<NoteResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/notes/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(note),
    });

    if (!response.ok) {
      throw new Error('Failed to create note');
    }

    return response.json();
  }

  async syncNotes(notes: NoteCreate[]): Promise<NoteResponse[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/notes/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync notes');
    }

    return response.json();
  }

  async getUserNotes(userId: string, status?: string): Promise<NoteResponse[]> {
    let url = `${this.baseUrl}/api/v1/notes/user/${userId}`;
    if (status) {
      url += `?status=${status}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch user notes');
    }

    return response.json();
  }

  async getPillars() {
    const response = await fetch(`${this.baseUrl}/api/v1/pillars/`);

    if (!response.ok) {
      throw new Error('Failed to fetch pillars');
    }

    return response.json();
  }

  async getClusters(pillarId?: string) {
    let url = `${this.baseUrl}/api/v1/clusters/`;
    if (pillarId) {
      url += `?pillar_id=${pillarId}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch clusters');
    }

    return response.json();
  }

  async getClusterTimeline(clusterId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/clusters/${clusterId}/timeline`);

    if (!response.ok) {
      throw new Error('Failed to fetch cluster timeline');
    }

    return response.json();
  }

  async getNoteTimeline(noteId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/notes/${noteId}/timeline`);

    if (!response.ok) {
      throw new Error('Failed to fetch note timeline');
    }

    return response.json();
  }
}

export const apiClient = new APIClient();

// Export simple API config for components
export const api = {
  baseURL: `${API_URL}/api/v1`,
};

