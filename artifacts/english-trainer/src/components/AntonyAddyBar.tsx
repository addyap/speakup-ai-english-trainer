/**
 * Bar linking back to www.antonyaddy.com. The same bar (markup, CSS in the
 * global stylesheet under .aa-bar) sits at the top of every section and app
 * served under the main domain, so visitors can always find the hub and the
 * other services. The current service is marked with aria-current.
 */
const AntonyAddyBar = () => (
  <nav className="aa-bar" aria-label="Antony Addy">
    <a className="aa-bar-home" href="https://www.antonyaddy.com/">
      <img
        className="aa-bar-mark"
        src="https://www.antonyaddy.com/brand/antony-addy-logo-white.svg"
        alt="Antony Addy"
        width={47}
        height={24}
      />
    </a>
    <ul className="aa-bar-services" lang="fr">
      <li>
        <a
          href="https://www.antonyaddy.com/offres-de-formation"
          aria-current="true"
        >
          Anglais
        </a>
      </li>
      <li>
        <a href="https://www.antonyaddy.com/ia">IA</a>
      </li>
      <li>
        <a href="https://www.antonyaddy.com/sites-web">Sites web</a>
      </li>
    </ul>
    <a className="aa-bar-back" href="https://www.antonyaddy.com/">
      <span className="aa-bar-arrow" aria-hidden="true">
        ←
      </span>{" "}
      antonyaddy.com
    </a>
    <a
      className="aa-bar-contact"
      href="https://www.antonyaddy.com/contact?sujet=anglais"
    >
      Contact
    </a>
  </nav>
);

export default AntonyAddyBar;
