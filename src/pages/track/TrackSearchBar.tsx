import type { FormEvent } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TrackSearchBarProps {
  queryInput: string;
  setQueryInput: (value: string) => void;
  isSearching: boolean;
  onSubmit: (e: FormEvent) => void;
  lastRefreshedAt: Date | null;
}

export default function TrackSearchBar({ queryInput, setQueryInput, isSearching, onSubmit, lastRefreshedAt }: TrackSearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="mb-10" autoComplete="off">
      <div className="relative group shadow-2xl shadow-black/20">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
        <input
          id="tracking-job-ref-input"
          name="nokael_job_reference_number"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          placeholder="Enter exact Job Ref (e.g. NOK-1024, NK-8492)"
          className="w-full bg-brand-input border border-brand-input-border rounded-2xl py-5 pl-14 pr-32 text-base sm:text-lg text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-neon/60 focus:ring-1 focus:ring-brand-neon/30 transition-all font-display tracking-tight"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={isSearching}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 btn-primary py-3 px-6 text-xs uppercase tracking-wider font-bold h-auto shadow-md disabled:opacity-50"
        >
          {isSearching ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Locating</span>
            </span>
          ) : (
            'Track'
          )}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-2 text-[11px] text-brand-muted">
        <span>Exact match required — enter your exact <b>Job Ref</b> (e.g. NOK-1024, NK-8492) or token</span>
        {lastRefreshedAt && (
          <span className="text-brand-muted/70">
            Synced {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>
        )}
      </div>
    </form>
  );
}
