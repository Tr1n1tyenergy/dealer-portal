/**
 * The login page for an account type (DEALER / DEPOT / INTERNAL) or a portal name from a link
 * (`?portal=dealer`). Each portal's login only accepts its own accounts, so password resets must
 * send people back to the right one. Anything unknown goes to the staff login.
 */
export function loginPathFor(accountTypeOrPortal: string | null | undefined): string {
  switch ((accountTypeOrPortal ?? "").toUpperCase()) {
    case "DEALER":
      return "/dealer/login";
    case "DEPOT":
      return "/depot/login";
    default:
      return "/intelligence/login";
  }
}
