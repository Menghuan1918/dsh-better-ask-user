/** Use the custom browser settings page instead of a generated form. */
export function mountSettings(ctx) {
  ctx.inject(['settings'], (inner) => {
    const dispose = inner.settings.configure({ auto: false }, ctx.fiber)
    inner.effect(() => dispose, 'better-ask-user: settings page')
  })
}
