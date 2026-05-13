import { db } from "@/lib/db";

export type UserSecurityQuestionRow = {
  id: string;
  userId: string;
  questionOrder: number;
  questionPrompt: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type UserSecurityQuestionWithHashRow = UserSecurityQuestionRow & {
  answerHash: string;
};

export type UserSecurityQuestionSummary = {
  userId: string;
  questionCount: number;
  securityQuestionsEnrolledAt: string | null;
  securityQuestionsRequired: boolean;
  offsiteSecurityBypassUntil: string | null;
};

export type ReplaceUserSecurityQuestionsInput = {
  userId: string;
  updatedBy: string | null;
  questions: Array<{
    questionOrder: number;
    questionPrompt: string;
    answerHash: string;
  }>;
};

export async function getUserSecurityQuestionSummary(
  userId: string
): Promise<UserSecurityQuestionSummary | null> {
  const { rows } = await db.query<UserSecurityQuestionSummary>(
    `
    SELECT
      u.id::text AS "userId",
      COALESCE(q.question_count, 0)::int AS "questionCount",
      u.security_questions_enrolled_at AS "securityQuestionsEnrolledAt",
      COALESCE(u.security_questions_required, false) AS "securityQuestionsRequired",
      u.offsite_security_bypass_until AS "offsiteSecurityBypassUntil"
    FROM public.users u
    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*) AS question_count
      FROM public.user_security_questions
      GROUP BY user_id
    ) q ON q.user_id = u.id
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

export async function listUserSecurityQuestions(
  userId: string
): Promise<UserSecurityQuestionRow[]> {
  const { rows } = await db.query<UserSecurityQuestionRow>(
    `
    SELECT
      id::text AS "id",
      user_id::text AS "userId",
      question_order AS "questionOrder",
      question_prompt AS "questionPrompt",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    FROM public.user_security_questions
    WHERE user_id = $1
    ORDER BY question_order ASC
    `,
    [userId]
  );

  return rows;
}

export async function listUserSecurityQuestionsWithHashes(
  userId: string
): Promise<UserSecurityQuestionWithHashRow[]> {
  const { rows } = await db.query<UserSecurityQuestionWithHashRow>(
    `
    SELECT
      id::text AS "id",
      user_id::text AS "userId",
      question_order AS "questionOrder",
      question_prompt AS "questionPrompt",
      answer_hash AS "answerHash",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    FROM public.user_security_questions
    WHERE user_id = $1
    ORDER BY question_order ASC
    `,
    [userId]
  );

  return rows;
}

export async function replaceUserSecurityQuestions(
  input: ReplaceUserSecurityQuestionsInput
): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM public.user_security_questions
      WHERE user_id = $1
      `,
      [input.userId]
    );

    for (const q of input.questions) {
      await client.query(
        `
        INSERT INTO public.user_security_questions (
          user_id,
          question_order,
          question_prompt,
          answer_hash,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          input.userId,
          q.questionOrder,
          q.questionPrompt,
          q.answerHash,
          input.updatedBy,
        ]
      );
    }

    await client.query(
      `
      UPDATE public.users
      SET
        security_questions_enrolled_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      `,
      [input.userId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}