/**
 * Science (`#/science`): how your taste relates to the population's, and how well the recommender
 * does on your own history.
 *
 * (a) agreement: your scores against the MovieLens mean, with the fitted line, Pearson, Spearman, n;
 * (b) cross-validated fit: RMSE and MAE of predicting your score from the population mean, against
 *     predicting your own average (the baseline);
 * (c) hold-out evaluation of the recommender (run on demand): hit rate, recall, NDCG and precision
 *     at k with bootstrap intervals;
 * (d) a short explainer, with links to the research notes.
 * The statistics are the core's (`agreement`, `crossValidatedFit`, `holdoutEvaluate`).
 */
import { agreement, crossValidatedFit, defaults as coreDefaults, ratingPairs, type RankingMetrics } from 'flickpick';
import { useMemo } from 'react';
import { AgreementChart, type AgreementPoint } from '@/charts/agreement-chart';
import { IntervalChart } from '@/charts/interval-chart';
import { CMD } from '@/commands/index';
import { RouteLink } from '@/components/route-link';
import { defaults } from '@/defaults';
import { errorMessage, titleYear } from '@/lib/utils';
import { useApp, useArtifacts, useDispatch } from '@/state/hooks';
import { Button } from '@/ui/button';
import { Card, Section } from '@/ui/card';
import { Notice, Spinner } from '@/ui/feedback';

const fmt = (v: number, digits: number = defaults.format.statDigits) => (Number.isFinite(v) ? v.toFixed(digits) : 'n/a');

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

function AgreementSection() {
  const artifacts = useArtifacts()!;
  const ratings = useApp((s) => s.ratings);
  const { stats, points } = useMemo(() => {
    const list = Object.values(ratings);
    const stats = agreement(list, artifacts.catalog);
    const { x, y } = ratingPairs(list, artifacts.catalog);
    // ratingPairs keeps the order of the latest rating per id; name each point the same way.
    const withMean = [...new Map(list.map((r) => [r.item_id, r])).keys()].filter((id) => {
      const idx = artifacts.idToIdx.get(id);
      return idx !== undefined && artifacts.catalog[idx]!.mean_rating !== null;
    });
    const points: AgreementPoint[] = x.map((xv, i) => {
      const item = artifacts.catalog[artifacts.idToIdx.get(withMean[i]!)!]!;
      return { x: xv, y: y[i]!, label: titleYear(item.title, item.year) };
    });
    return { stats, points };
  }, [ratings, artifacts]);

  return (
    <Section title="Your taste against the population" id="agreement-heading">
      <p className="text-sm text-muted-foreground">
        Each dot is a film you rated that is in the catalogue: your score against the mean MovieLens rating (rescaled to 0-100). A correlation near 1 means you rate like the crowd; near 0, that the crowd says little about you.
      </p>
      {stats.n < 2 ? (
        <Notice>Rate at least two catalogue titles to see this.</Notice>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Pearson r" value={fmt(stats.pearson)} hint="Linear correlation of the scores" />
            <Stat label="Spearman ρ" value={fmt(stats.spearman)} hint="Correlation of the ranks (robust to scale)" />
            <Stat label="n" value={String(stats.n)} hint="Rated titles with a population mean" />
            <Stat label="Fitted line" value={`${fmt(stats.slope)}x ${stats.intercept < 0 ? '−' : '+'} ${fmt(Math.abs(stats.intercept), 0)}`} hint="Least squares: your score from the population mean" />
          </dl>
          <AgreementChart points={points} slope={stats.slope} intercept={stats.intercept} />
        </>
      )}
    </Section>
  );
}

function FitSection() {
  const artifacts = useArtifacts()!;
  const ratings = useApp((s) => s.ratings);
  const fit = useMemo(() => {
    try {
      return { ok: true as const, value: crossValidatedFit(Object.values(ratings), artifacts.catalog) };
    } catch (e) {
      return { ok: false as const, message: errorMessage(e) };
    }
  }, [ratings, artifacts]);

  return (
    <Section title="Can the crowd predict your score?" id="fit-heading">
      <p className="text-sm text-muted-foreground">
        {coreDefaults.science.folds}-fold cross-validation: predict each held-out score from the population mean with the fitted line, and compare with simply predicting your average score. Lower is better; errors are in points on the 0-100 scale.
      </p>
      {!fit.ok ? (
        <Notice>{fit.message}</Notice>
      ) : (
        <table className="w-full max-w-lg text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Predictor</th>
              <th className="py-1 text-right font-normal">RMSE</th>
              <th className="py-1 text-right font-normal">MAE</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-1">Line through the population mean</td>
              <td className="py-1 text-right tabular-nums">{fmt(fit.value.linear.rmse, 1)}</td>
              <td className="py-1 text-right tabular-nums">{fmt(fit.value.linear.mae, 1)}</td>
            </tr>
            <tr className="border-t">
              <td className="py-1">Your average (baseline)</td>
              <td className="py-1 text-right tabular-nums">{fmt(fit.value.baseline.rmse, 1)}</td>
              <td className="py-1 text-right tabular-nums">{fmt(fit.value.baseline.mae, 1)}</td>
            </tr>
            <tr className="border-t text-muted-foreground">
              <td className="py-1" colSpan={3}>
                n = {fit.value.n} ratings, {fit.value.folds} folds
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Section>
  );
}

const METRIC_LABEL: Record<keyof RankingMetrics, string> = {
  hit_rate: 'hit rate',
  recall: 'recall',
  ndcg: 'NDCG',
  precision: 'precision',
};

function HoldoutSection() {
  const evaluation = useApp((s) => s.evaluation);
  const dispatch = useDispatch();
  const result = evaluation.result;
  const k = result?.k ?? coreDefaults.science.k;

  return (
    <Section
      title="How well does it recommend for you?"
      id="holdout-heading"
      actions={
        <Button onClick={() => void dispatch(CMD.evaluate)} disabled={evaluation.status === 'loading'}>
          {result ? 'Run again' : 'Run the evaluation'}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Your liked titles are split into {coreDefaults.science.folds} folds. Each fold is hidden in turn, the recommender scores the whole catalogue from the rest, and we check whether the hidden titles come back in its top {k}. Hit rate: share of folds with at least one hidden title in the top {k}; recall: share of hidden titles found; NDCG also rewards finding them near the top; precision: share of the top {k} that were hidden titles.
      </p>
      {evaluation.status === 'loading' && <Spinner label="Evaluating" />}
      {evaluation.status === 'error' && <Notice tone="error">{evaluation.error}</Notice>}
      {result && evaluation.status === 'ready' && (
        <>
          <p className="text-sm">
            {result.n_liked} liked titles out of {result.n_rated_in_catalog} rated in the catalogue, {result.folds.length} folds, top {result.k}.
          </p>
          <IntervalChart
            label={`Ranking metrics at ${result.k}, mean and 95% interval`}
            rows={(Object.keys(METRIC_LABEL) as (keyof RankingMetrics)[]).map((m) => ({
              label: METRIC_LABEL[m],
              mean: result.mean[m],
              low: result.ci95[m][0],
              high: result.ci95[m][1],
            }))}
          />
          <Notice>
            What the interval means for one person: it is a bootstrap over your {result.folds.length} folds, so it shows how much the score moves with which of your titles happened to be hidden, not how the recommender would do for other people. With a few dozen liked titles, two methods whose hit rates differ by less than about ten points cannot be told apart on your data alone.
          </Notice>
        </>
      )}
    </Section>
  );
}

function Explainer() {
  const doc = (path: string) => `${defaults.app.repoBlobUrl}${path}`;
  return (
    <Section title="How recommenders work, briefly" id="explainer-heading">
      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <p>
          <strong>Collaborative filtering</strong> recommends from what other people did, not from what films are about: if many who liked A also liked B, liking A is evidence for B. It needs no description of the films, only a large table of who rated what (here, MovieLens).
        </p>
        <p>
          <strong>EASE</strong> (Embarrassingly Shallow Autoencoder, Steck 2019) learns one item-by-item weight matrix B in closed form: it predicts each film's column from all the others, with ridge regularisation and the diagonal forced to zero so a film cannot explain itself. Your score for a film is the sum of B's weights from the films you liked. It is a few lines of linear algebra and matches or beats most neural recommenders on this kind of data; here B is cut to each film's strongest neighbours so it fits in a browser.
        </p>
        <p>
          <strong>Why ranking metrics, not RMSE.</strong> A recommender's job is to put a few good films at the top of a list of thousands, not to predict your exact score for every film. RMSE rewards being accurate about films you will never watch; hit rate, recall and NDCG at k measure the list you actually see.
        </p>
        <p>
          <strong>Why the language model does not rank.</strong> Here a small embedding model turns your mood into a vector that is compared with film descriptions; that is one signal among others. A large language model, when one is added, will turn requests into structured queries and explain results. Ranking stays deterministic and inspectable, because with your ratings available, collaborative filtering beats LLM rankers, and an LLM's ranking cannot be audited.
        </p>
        <p>
          More: the{' '}
          <a className="text-primary underline" href={doc('docs/research/recsys-methods-libraries-evaluation.md')} target="_blank" rel="noreferrer">
            methods and evaluation report
          </a>
          , the{' '}
          <a className="text-primary underline" href={doc('docs/research/movie-recommender-research-synthesis.md')} target="_blank" rel="noreferrer">
            research synthesis
          </a>
          , the{' '}
          <a className="text-primary underline" href={doc('docs/architecture.md')} target="_blank" rel="noreferrer">
            architecture
          </a>{' '}
          and the{' '}
          <a className="text-primary underline" href={doc('docs/core-contract.md')} target="_blank" rel="noreferrer">
            scoring contract
          </a>
          .
        </p>
      </Card>
    </Section>
  );
}

export function SciencePage() {
  const nRatings = useApp((s) => Object.keys(s.ratings).length);
  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold" tabIndex={-1}>
          For scientists
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything on this page is computed in your browser from your ratings and the loaded artifact set.
          {nRatings === 0 && (
            <>
              {' '}
              <RouteLink to={{ screen: 'ratings', params: {} }} className="text-primary underline">
                Import ratings
              </RouteLink>{' '}
              to fill it in.
            </>
          )}
        </p>
      </header>
      <AgreementSection />
      <FitSection />
      <HoldoutSection />
      <Explainer />
    </div>
  );
}
