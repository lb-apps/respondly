/**
 * An image whose URL belongs to someone else's site.
 *
 * Sites behind Cloudflare's hotlink protection refuse a request whose `Referer`
 * names a different host — the dashboard asking for a room photo on the hotel's
 * own domain comes back as an "Error 1011 / Access denied" page instead of the
 * picture. The same file loads fine with no referrer at all, which is what the
 * protection is there to allow: a request that is not a page on another site
 * embedding the image.
 *
 * So every image we did not host ourselves is requested without a referrer.
 * Nothing is lost by it — the referrer was only ever leaking which dashboard
 * page the team happened to be on to whichever host owns the file.
 *
 * Deliberately not `next/image`: these URLs come from a connected system or a
 * knowledge source at runtime, so there is no host list to configure them
 * against, and no build-time knowledge of their size.
 */
export function RemoteImage({
  ...props
}: React.ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img referrerPolicy="no-referrer" {...props} alt={props.alt ?? ""} />
}
