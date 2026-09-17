import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BusinessInquiry } from '../../lib/supabase';

interface BusinessViewProps {
  filteredBusiness: BusinessInquiry[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onStatusUpdate: (id: string, updates: Partial<BusinessInquiry>) => void;
  onViewDetails: (biz: BusinessInquiry) => void;
}

export function BusinessView({
  filteredBusiness,
  searchTerm,
  setSearchTerm,
  onStatusUpdate,
  onViewDetails,
}: BusinessViewProps) {
  return (
    <div className="dispatch-card overflow-hidden p-0">
      <div className="p-5 border-b border-brand-border flex justify-end">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input 
            type="text" 
            placeholder="Search accounts..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-brand-neon/50 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-brand-input text-[11px] uppercase tracking-wide font-medium text-brand-muted">
              <th className="px-6 py-3">Company</th>
              <th className="px-6 py-3">Volume</th>
              <th className="px-6 py-3">Billing</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {filteredBusiness.map((biz) => (
              <tr key={biz.id} className="hover:bg-brand-input transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-medium text-brand-text mb-1.5 text-sm">{biz.company_name}</div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-brand-muted font-medium">{biz.contact_person} • {biz.phone_whatsapp}</div>
                    <div className="text-[11px] text-brand-neon font-medium font-mono">ID: {biz.corporate_code}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium mb-1.5">{biz.estimated_monthly_volume} jobs/mo</div>
                  <div className="text-xs uppercase tracking-wide text-brand-muted font-medium truncate max-w-[200px]">{biz.typical_routes}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={cn(
                    "px-3 py-1 inline-block rounded text-[11px] font-medium",
                    biz.invoicing_required ? "bg-brand-neon/10 text-brand-neon border border-brand-neon/20" : "bg-brand-muted/10 text-brand-muted"
                  )}>
                    {biz.invoicing_required ? 'Monthly Invoicing' : 'Standard Pay'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={biz.status}
                    onChange={(e) => onStatusUpdate(biz.id!, { status: e.target.value as any })}
                    className={`text-[11px] font-medium uppercase tracking-wide px-4 py-2 rounded-lg border outline-none transition-all ${
                      biz.status === 'active' ? 'bg-brand-neon/5 border-brand-neon/20 text-brand-neon' :
                      biz.status === 'archived' ? 'bg-red-500/5 border-red-500/20 text-red-500' :
                      'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                    }`}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onViewDetails(biz)}
                    className="px-6 py-2.5 bg-brand-surface border border-brand-border text-brand-text text-xs font-medium rounded-lg hover:bg-brand-neon hover:text-brand-bg transition-all"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
