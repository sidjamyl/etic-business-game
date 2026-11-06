/**
 * Dark universe for a whole route (DESIGN.md §6: organizer screens, black market). The class
 * goes on <html> so that dialogs, menus, selects and toasts — rendered in portals outside the
 * page — follow it too. Route lifecycle hooks, no effect needed.
 */
export const darkRoute = {
  onEnter: () => document.documentElement.classList.add("dark"),
  onLeave: () => document.documentElement.classList.remove("dark"),
};
