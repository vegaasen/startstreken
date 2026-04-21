export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Løypevær — værmeldinger for norske utholdenhetsarrangement</span>
      <span>
        Data:{" "}
        <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">
          Open-Meteo
        </a>{" "}
        &{" "}
        <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>
      </span>
      <span>
        <a
          href="https://github.com/vegaasen/startstreken/issues/new?template=suggest-ritt.yml"
          target="_blank"
          rel="noopener noreferrer"
        >
          Foreslå et arrangement
        </a>
      </span>
      <span>
        Laget av{" "}
        <a href="https://www.vegaasen.com" target="_blank" rel="noopener noreferrer">
          Vegard Aasen
        </a>
      </span>
    </footer>
  );
}
