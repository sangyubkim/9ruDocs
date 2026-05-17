export async function generateBlogPost(body, env) {
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const tone = body?.tone === "professional" ? "professional" : "friendly";

  if (steps.length === 0) {
    throw new Error("steps is required");
  }

  const sorted = [...steps].sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
  );

  if (env.openaiApiKey) {
    return generateWithOpenAi(sorted, tone, env);
  }

  return generateFallback(sorted, tone);
}

async function generateWithOpenAi(steps, tone, env) {
  const stepText = steps
    .map((s, i) => `${i + 1}. ${String(s.caption ?? "").trim() || "(설명 없음)"}`)
    .join("\n");

  const system =
    tone === "professional"
      ? "당신은 IT 튜토리얼 전문 작가입니다. Markdown으로 구조화된 블로그 글을 작성합니다."
      : "당신은 친근한 블로그 작가입니다. Markdown으로 읽기 쉬운 글을 작성합니다.";

  const user = `다음 단계 메모만으로 블로그 글을 작성해 주세요.

단계:
${stepText}

JSON만 반환하세요:
{
  "title": "제목",
  "body": "Markdown 본문",
  "excerpt": "2~3문장 요약",
  "suggestedTags": ["태그1", "태그2"]
}`;

  const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  const parsed = JSON.parse(content);
  return {
    title: String(parsed.title ?? "제목 없음"),
    body: String(parsed.body ?? ""),
    excerpt: String(parsed.excerpt ?? ""),
    suggestedTags: Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map(String)
      : [],
  };
}

function generateFallback(steps, tone) {
  const intro =
    tone === "professional"
      ? "이 글은 단계별 기록을 바탕으로 정리했습니다."
      : "오늘은 제가 직접 해본 과정을 차근차근 공유해 볼게요!";

  const sections = steps
    .map((s, i) => {
      const cap = String(s.caption ?? "").trim() || "내용을 추가해 주세요.";
      return `## ${i + 1}단계\n\n${cap}\n`;
    })
    .join("\n");

  const title =
    String(steps[0]?.caption ?? "").trim().slice(0, 40) || "나의 작업 기록";

  const body = `# ${title}\n\n${intro}\n\n${sections}`;
  const excerpt = String(steps[0]?.caption ?? "").trim().slice(0, 160) || intro;

  const tags = steps
    .flatMap((s) =>
      String(s.caption ?? "")
        .split(/\s+/)
        .filter((w) => w.length >= 2)
        .slice(0, 2),
    )
    .slice(0, 5);

  return {
    title,
    body,
    excerpt,
    suggestedTags: tags.length ? tags : ["일상", "기록"],
  };
}
