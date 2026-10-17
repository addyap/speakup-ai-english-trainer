/**
 * Slim bar linking back to www.antonyaddy.com. The same bar (markup, CSS in
 * the global stylesheet under .aa-bar) sits at the top of every app served
 * under the main domain, so visitors can always find the trainer behind it.
 */
const AntonyAddyBar = () => (
  <nav className="aa-bar" aria-label="Antony Addy">
    <a className="aa-bar-home" href="https://www.antonyaddy.com/">
      <img
        className="aa-bar-mark"
        src="https://www.antonyaddy.com/brand/antony-addy-logo-white.svg"
        alt="Antony Addy"
        width={39}
        height={20}
      />
      <span className="aa-bar-sub">Formations d'anglais · antonyaddy.com</span>
    </a>
    <a className="aa-bar-contact" href="https://www.antonyaddy.com/contact">
      Contact
    </a>
  </nav>
);

export default AntonyAddyBar;
