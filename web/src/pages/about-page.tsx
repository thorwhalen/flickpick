/** About (`#/about`): the author's note, the data and licensing notes, what stays local. */
import { TmdbAttribution } from '@/components/tmdb-attribution';
import { defaults } from '@/defaults';
import { Section } from '@/ui/card';

export function AboutPage() {
  const { repoUrl, repoBlobUrl } = defaults.app;
  return (
    <div className="max-w-2xl space-y-8 leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">About flickpick</h1>
        <p className="text-muted-foreground">A personal movie recommender that runs in your browser.</p>
      </header>

      <Section title="Why I built it" id="why-heading">
        <p>
          I got into recommender systems around 2004, trying to understand musical tastes and how they trend. Soon after, I was building them in a marketing context, a sector I worked in significantly until 2016.
        </p>
        <p>
          Twenty-plus years later, I am still not satisfied with the movie recommendations I get. Agentic coding now makes development orders of magnitude faster, so I might as well make the one I'd want: one that learns from my own ratings, lets me ask for a mood, shows its reasons, and lets me measure how well it does for me.
        </p>
      </Section>

      <Section title="Data and licensing" id="data-heading">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            The catalogue and the collaborative model come from{' '}
            <a className="text-primary underline" href="https://grouplens.org/datasets/movielens/" target="_blank" rel="noreferrer">
              MovieLens
            </a>{' '}
            (GroupLens Research), whose licence allows research and non-commercial use; transformations are shared under the same terms. This instance is non-commercial.
          </li>
          <li>Later versions add facts from Wikidata (CC0) and plot text from Wikipedia (CC BY-SA, with attribution).</li>
          <li>
            Posters, overviews, runtimes, certifications and streaming availability come live from TMDB, with your own API key, for display only. They are cached in this browser for at most six months and are never used by the recommender or by any language model, because TMDB's terms exclude machine-learning uses. Streaming availability is JustWatch data, through TMDB.
          </li>
        </ul>
        <TmdbAttribution withJustWatch />
      </Section>

      <Section title="What stays on your device" id="local-heading">
        <p>
          Your ratings, your settings and your TMDB key are stored in this browser (localStorage) and are never uploaded. Imported files are read locally. The mood model runs in your browser, downloaded once from the Hugging Face hub. The only requests that leave the page are for the artifact set, the model files, and (with your key) TMDB.
        </p>
      </Section>

      <Section title="Code" id="code-heading">
        <p>
          The source, the build pipeline and the research behind the design are on{' '}
          <a className="text-primary underline" href={repoUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
          : start with the{' '}
          <a className="text-primary underline" href={`${repoBlobUrl}docs/architecture.md`} target="_blank" rel="noreferrer">
            architecture
          </a>{' '}
          and the{' '}
          <a className="text-primary underline" href={`${repoBlobUrl}docs/research/README.md`} target="_blank" rel="noreferrer">
            research notes
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
