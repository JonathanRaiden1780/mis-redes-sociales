# Sharing an Invite: Web Share API with Layered Fallbacks

For invite-code products (game lobbies, house/room joins), a bare "open link" anchor
is the wrong affordance. The user's actual goal is *sending* the invite to someone on
another device, usually over WhatsApp. Direct feedback from the PlayScore sessions:

> "en el de abrir link para la invitación, debe ser mejor compartir invitación para
> poder enviar el link con el codigo"

Two things matter: the action must be **share**, not **open**, and the payload must
carry the **code and the link together** — a bare URL loses the code if the recipient
copies only part of the message.

## The message payload

Build one string containing context, code, and deep link. Reuse it for every channel
so the recipient sees the same thing regardless of transport.

```jsx
const shareUrl  = `${window.location.origin}/join?code=${house.inviteCode}`
const shareText =
  `¡Únete a mi casa "${house.name}" en PlayScore!\n\n` +
  `Código: ${house.inviteCode}\n\n${shareUrl}`
```

The deep link must prefill the code on arrival, so the recipient only types a name:

```jsx
// GuestJoinPage.jsx
useEffect(() => {
  const code = new URL(window.location.href).searchParams.get('code')
  if (code) setCode(code.toUpperCase())
}, [])
```

## Tier 1 — native share sheet

`navigator.share` opens the OS sheet (WhatsApp, Telegram, SMS, AirDrop). Only
available over HTTPS or localhost, and absent on most desktop browsers — so the
fallback is not optional.

Treat `AbortError` as success: the user deliberately dismissed the sheet, and showing
a "copied" toast after a cancel is misleading.

```jsx
const shareInvitation = async () => {
  if (navigator.share) {
    try {
      await navigator.share({ title: `PlayScore - ${house.name}`, text: shareText, url: shareUrl })
      return
    } catch (e) {
      if (e.name === 'AbortError') return   // user cancelled — not a failure
    }
  }
  // Tier 2 — clipboard with the FULL message, not just the URL
  try {
    await navigator.clipboard.writeText(shareText)
    setShareMsg('✓ Invitación copiada — pégala en WhatsApp')
  } catch {
    setShareMsg('No se pudo copiar')
  }
  setTimeout(() => setShareMsg(''), 3000)
}
```

## Tier 3 — explicit WhatsApp button

Do not rely on the share sheet surfacing WhatsApp. A dedicated button in brand green
is faster and works on desktop too, where `navigator.share` is missing entirely.

```jsx
const shareWhatsApp = () =>
  window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
```

```jsx
<button onClick={shareWhatsApp}
  style={{ background: '#25D366', color: '#ffffff' }}
  className="flex items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-semibold">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">{/* glyph */}</svg>
  WhatsApp
</button>
```

## Layout and contrast

Buttons sit on a gradient invite card, so **pin their colours inline** — gradient
backgrounds plus stylesheet-driven button colours is exactly where invisible-control
bugs appear.

```jsx
<div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
     className="rounded-2xl p-6 mb-6 shadow-lg">
  <span className="text-4xl font-bold tracking-widest font-mono" style={{ color: '#ffffff' }}>
    {house.inviteCode}
  </span>
  {/* primary share = white bg + accent text; WhatsApp = brand green + white */}
</div>
```

Keep the separate **Copy** button for the code alone — some users want just the code
to dictate verbally.

## Verifying the fallback without a phone

Desktop browsers lack `navigator.share`, which is convenient: it exercises the
clipboard path. Intercept `writeText` to assert the exact payload.

```js
// browser_console expression
(async () => {
  let captured = null;
  const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async t => { captured = t; return orig(t).catch(()=>{}); };
  [...document.querySelectorAll('button')]
    .find(b => b.textContent.includes('Compartir invitación')).click();
  await new Promise(r => setTimeout(r, 400));
  return { textoCompartido: captured };
})()
```

Assert all three parts are present — house name, code, and URL:

```
¡Únete a mi casa "Casa Demo" en PlayScore!

Código: 876BAA7E

http://localhost:5173/join?code=876BAA7E
```

Then confirm the deep link end-to-end: navigate to `/join?code=XXXX`, check the code
field is prefilled, type a name, submit, and query the roster API to prove the guest
actually landed in the house.
