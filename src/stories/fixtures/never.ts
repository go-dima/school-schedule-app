// A fetch that never settles: a stubbed page stays in its loading state.
export const never = () => new Promise<never>(() => {});
