/**
 * What the model is told about *when* a rich message reaches the customer.
 *
 * A turn produces at most one text bubble and any number of rich messages —
 * photos, a carousel, an option list, a link button, a pin. The text always
 * goes out first and the rich messages follow, in the order the tools queued
 * them (`sendAssistantReply`).
 *
 * The model could not know that. It sees a tool return `queued: true` while it
 * is still composing, which reads as "already sent", and then writes about the
 * carousel as if it were above — when it is in fact still waiting behind the
 * sentence being written. That is not a wording slip to forbid; it is a fact
 * about the transport that was missing from its context, so every rich tool now
 * returns it.
 */
export const DELIVERY_AFTER_REPLY =
  "Not sent yet. It is queued and goes out after your reply text, so the customer sees it *below* your words — never above them."

/** The same fact for images the system attaches to a reply on the model's behalf. */
export const DELIVERY_IMAGES_AFTER_REPLY =
  "Images from these passages are attached automatically and go out after your reply text, so they land below your words."
