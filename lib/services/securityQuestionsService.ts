import bcrypt from "bcryptjs";
import {
  listUserSecurityQuestions,
  replaceUserSecurityQuestions,
  type UserSecurityQuestionRow,
  getUserSecurityQuestionSummary,
  type UserSecurityQuestionSummary,
} from "@/lib/repositories/userAccountRepo";

export type SecurityQuestionInput = {
  questionOrder: number;
  questionPrompt: string;
  answer: string;
};

export type SecurityQuestionsAccountPayload = {
  summary: UserSecurityQuestionSummary | null;
  questions: UserSecurityQuestionRow[];
};

const BCRYPT_ROUNDS = 12;

export function normalizeSecurityAnswer(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePrompt(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function validateInputs(inputs: SecurityQuestionInput[]) {
  if (!Array.isArray(inputs) || inputs.length !== 3) {
    return "Exactly 3 security questions are required.";
  }

  const orders = new Set<number>();
  const prompts = new Set<string>();

  for (const input of inputs) {
    const order = Number(input.questionOrder);
    const prompt = normalizePrompt(input.questionPrompt);
    const answer = normalizeSecurityAnswer(input.answer);

    if (![1, 2, 3].includes(order)) {
      return "Each security question must have an order from 1 to 3.";
    }

    if (orders.has(order)) {
      return "Security question order values must be unique.";
    }

    orders.add(order);

    if (prompt.length < 8) {
      return "Each security question must be at least 8 characters.";
    }

    const promptKey = prompt.toLowerCase();
    if (prompts.has(promptKey)) {
      return "Security questions must be different from each other.";
    }

    prompts.add(promptKey);

    if (answer.length < 2) {
      return "Each security answer must be at least 2 characters.";
    }

    if (answer.length > 200) {
      return "Security answers must be 200 characters or less.";
    }
  }

  return null;
}

export async function getAccountSecurityQuestions(
  userId: string
): Promise<SecurityQuestionsAccountPayload> {
  const [summary, questions] = await Promise.all([
    getUserSecurityQuestionSummary(userId),
    listUserSecurityQuestions(userId),
  ]);

  return {
    summary,
    questions,
  };
}

export async function saveAccountSecurityQuestions(input: {
  userId: string;
  updatedBy: string | null;
  questions: SecurityQuestionInput[];
}): Promise<void> {
  const validationError = validateInputs(input.questions);
  if (validationError) {
    throw new Error(validationError);
  }

  const hashedQuestions = await Promise.all(
    input.questions
      .slice()
      .sort((a, b) => Number(a.questionOrder) - Number(b.questionOrder))
      .map(async (q) => {
        const normalizedAnswer = normalizeSecurityAnswer(q.answer);
        const answerHash = await bcrypt.hash(normalizedAnswer, BCRYPT_ROUNDS);

        return {
          questionOrder: Number(q.questionOrder),
          questionPrompt: normalizePrompt(q.questionPrompt),
          answerHash,
        };
      })
  );

  await replaceUserSecurityQuestions({
    userId: input.userId,
    updatedBy: input.updatedBy,
    questions: hashedQuestions,
  });
}