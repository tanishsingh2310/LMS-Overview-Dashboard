
import SchoolCard from "../components/SchoolCard";

export default function OverviewPage({ entities, onSelect }) {
  return (
    <>

      <main>
        <section
          className="school-grid"
          aria-label="University and schools overview"
        >
          {entities.map((entity) => (
            <SchoolCard
              key={entity.shortname}
              entity={entity}
              onSelect={onSelect}
            />
          ))}
        </section>
      </main>
    </>
  );
}
