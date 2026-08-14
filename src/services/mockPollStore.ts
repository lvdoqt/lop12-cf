export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  code: string;
  question: string;
  options: PollOption[];
  created_at: string;
  status: 'active' | 'closed';
  created_by: string;
}

// Global in-memory store
const polls = new Map<string, Poll>();

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const pollStore = {
  createPoll: (question: string, optionsTexts: string[], userId: string): Poll => {
    let code = generateCode();
    while (polls.has(code)) {
      code = generateCode();
    }

    const poll: Poll = {
      id: `poll-${Date.now()}`,
      code,
      question,
      options: optionsTexts.map((text, i) => ({
        id: `opt-${i}`,
        text,
        votes: 0
      })),
      created_at: new Date().toISOString(),
      status: 'active',
      created_by: userId
    };

    polls.set(code, poll);
    return poll;
  },

  getPollByCode: (code: string): Poll | null => {
    return polls.get(code.toUpperCase()) || null;
  },

  vote: (code: string, optionId: string): boolean => {
    const poll = polls.get(code.toUpperCase());
    if (!poll || poll.status !== 'active') return false;

    const opt = poll.options.find(o => o.id === optionId);
    if (opt) {
      opt.votes += 1;
      return true;
    }
    return false;
  },

  closePoll: (code: string, userId: string): boolean => {
    const poll = polls.get(code.toUpperCase());
    if (poll && poll.created_by === userId) {
      poll.status = 'closed';
      return true;
    }
    return false;
  }
};
