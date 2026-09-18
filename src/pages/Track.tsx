import { AnimatePresence } from 'motion/react';
import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTrackingSearch } from './track/useTrackingSearch';
import { getJobStatusConfig } from './track/statusConfig';
import TrackSearchBar from './track/TrackSearchBar';
import { TrackSearchingState, TrackNotFoundState } from './track/TrackEmptyStates';
import TrackJobResult from './track/TrackJobResult';
import TrackQuoteResult from './track/TrackQuoteResult';

export default function Track() {
  const { t } = useTranslation('tracking');
  const {
    queryInput,
    setQueryInput,
    isSearching,
    isRefreshing,
    searchStatus,
    result,
    activeJob,
    activeQuote,
    lastRefreshedAt,
    copiedLink,
    realtimeConnected,
    handleSubmit,
    handleRefresh,
    handleCopyLink,
  } = useTrackingSearch();

  const hasDriver = !!(activeJob?.driver || activeJob?.driver_id);
  const statusConfig = activeJob
    ? getJobStatusConfig(activeJob.status, hasDriver)
    : null;

  // Build WhatsApp inquiry link
  // ⚠ waSupportText is a WhatsApp message to Nokael's own dispatch number, not the
  // customer — decision (A) "keep fixed" applies, left as a plain template literal,
  // not wired to t().
  const currentTrackingId = result?.trackingId || queryInput;
  const waSupportText = encodeURIComponent(
    `Hi Nokael Dispatch, I am tracking manifest ${currentTrackingId}${activeJob ? ` (${activeJob.pickup_emirate} ➔ ${activeJob.delivery_emirate})` : ''
    } and would like a live status update.`
  );

  return (
    <div className="bg-brand-bg min-h-[85vh] py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-4">
            <Radio className="w-3.5 h-3.5 text-brand-neon animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-neon">
              {t('page.liveBadge')}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-4 text-brand-text">
            {t('page.title')}
          </h1>
          <p className="text-brand-muted text-sm max-w-lg mx-auto leading-relaxed">
            {t('page.subtitle')}
          </p>
        </div>

        <TrackSearchBar
          queryInput={queryInput}
          setQueryInput={setQueryInput}
          isSearching={isSearching}
          onSubmit={handleSubmit}
          lastRefreshedAt={lastRefreshedAt}
        />

        {/* Dynamic Tracking Display */}
        <AnimatePresence mode="wait">
          {searchStatus === 'searching' && (
            <TrackSearchingState queryInput={queryInput} />
          )}

          {searchStatus === 'not_found' && (
            <TrackNotFoundState queryInput={queryInput} waSupportText={waSupportText} />
          )}

          {searchStatus === 'found' && activeJob && statusConfig && (
            <TrackJobResult
              activeJob={activeJob}
              statusConfig={statusConfig}
              result={result!}
              realtimeConnected={realtimeConnected}
              isRefreshing={isRefreshing}
              copiedLink={copiedLink}
              onRefresh={handleRefresh}
              onCopyLink={handleCopyLink}
              currentTrackingId={currentTrackingId}
            />
          )}

          {searchStatus === 'found' && activeQuote && !activeJob && (
            <TrackQuoteResult activeQuote={activeQuote} />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
