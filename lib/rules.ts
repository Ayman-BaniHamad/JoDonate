// This function checks whether an item is allowed to be marked as "donated"
// It returns true only if the item status is "accepted"
export function canMarkDonated(status: string): boolean {
  // Business rule:
  // An item can be marked as donated ONLY after a request has been accepted
  return status === "accepted";
}
