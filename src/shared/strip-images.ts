type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; [key: string]: unknown }
  | { type: string; [key: string]: unknown };

type MessageLike = {
  role: string;
  content: string | ContentPart[];
  [key: string]: unknown;
};

function isImagePart(part: ContentPart): boolean {
  if (part.type === "image") return true;
  if (part.type === "image_url") return true;
  if (
    part.type === "file" &&
    typeof part.mime === "string" &&
    part.mime.startsWith("image/")
  )
    return true;
  return false;
}

export function stripImages<T extends MessageLike>(messages: T[]): T[] {
  return messages.map((msg) => {
    if (typeof msg.content === "string") return msg;
    if (!Array.isArray(msg.content)) return msg;

    const hasImages = msg.content.some(isImagePart);
    if (!hasImages) return msg;

    const filtered = msg.content.map((part) => {
      if (!isImagePart(part)) return part;
      return { type: "text" as const, text: "[image]" };
    });

    return { ...msg, content: filtered };
  });
}
