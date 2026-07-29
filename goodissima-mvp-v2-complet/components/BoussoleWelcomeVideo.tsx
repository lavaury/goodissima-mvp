export function BoussoleWelcomeVideo() {
  return (
    <figure className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-lg sm:p-4">
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <video
          className="h-full w-full object-contain outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset"
          controls
          playsInline
          preload="metadata"
        >
          <source src="/media/boussole-introduction.mp4" type="video/mp4" />
          Votre navigateur ne permet pas de lire cette vidéo. Vous pouvez poursuivre la découverte sans la regarder.
        </video>
      </div>
      <figcaption className="px-1 pt-3 text-sm leading-relaxed text-slate-200">
        Une introduction visuelle à la raison d’être de Goodissima.
      </figcaption>
      {/* À compléter dans un lot ultérieur : poster WebP, sous-titres français VTT et transcription textuelle. */}
    </figure>
  );
}
