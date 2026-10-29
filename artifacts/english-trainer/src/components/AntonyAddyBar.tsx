/**
 * The shared top bar: the one global navigation on every section and app
 * served under www.antonyaddy.com (markup and .aa-bar CSS are copied, not
 * imported, so keep them identical across projects). The logo goes to the
 * hub; the three activities always appear in the hub's order (English,
 * websites, AI) with the current one marked. No contact button here.
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
    <ul className="aa-bar-services" lang="en">
      <li>
        <a
          href="https://www.antonyaddy.com/offres-de-formation"
          aria-current="true"
        >
          English
        </a>
      </li>
      <li>
        <a href="https://www.antonyaddy.com/sites-web/en">Websites</a>
      </li>
      <li>
        <a href="https://www.antonyaddy.com/ia/en">AI</a>
      </li>
    </ul>
  </nav>
);

export default AntonyAddyBar;
