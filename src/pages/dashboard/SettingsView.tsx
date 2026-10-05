import React from 'react';
import { Settings as SettingsIcon, Building2, Bell, Globe, Moon, Sun, Network, ExternalLink, FileCheck2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountSettings } from './AccountSettings';
import { PushSettingsCard } from './components/PushSettingsCard';
import { CompaniesPanel } from './components/CompaniesPanel';
import { DomainCard } from './components/DomainCard';
import { CocTemplateCard } from './components/CocTemplateCard';
import { getOnboardingMe, type OnboardingMe } from '../../lib/onboarding';
import { findCountry } from '../../lib/countries';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  userEmail?: string;
  orgId?: string | null;
  currentRole?: string | null;
}

type SettingsTab = 'organization' | 'coc' | 'notifications' | 'preferences' | 'companies';

export function SettingsView({ theme, onThemeChange, userEmail, orgId, currentRole }: SettingsViewProps) {
  const { t, i18n } = useTranslation('dashboard');
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('organization');
  
  const canManageOrg = currentRole === 'owner' || currentRole === 'admin';
  const navigate = useNavigate();
  const [me, setMe] = React.useState<OnboardingMe | null>(null);
  React.useEffect(() => {
    if (!orgId) return;
    getOnboardingMe().then(setMe).catch(() => setMe(null));
  }, [orgId]);
  const orgSettings = me?.org.settings ?? {};
  const orgBranding = me?.org.branding ?? {};

  return (
    <>
      <div className="settings-page">
        <div className="settings-shell">
          <div className="settings-tabs">
            <button
              onClick={() => setActiveTab('organization')}
              className={activeTab === 'organization' ? 'active' : ''}
            >
              <span className="settings-tab-icon">
                <Building2 size={16} />
              </span>
              <span>
                <b>{t('settings.tabs.organization.title') || 'Organization'}</b>
                <small>{t('settings.tabs.organization.subtitle') || 'Company details and billing'}</small>
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            <button
              onClick={() => setActiveTab('coc')}
              className={activeTab === 'coc' ? 'active' : ''}
            >
              <span className="settings-tab-icon">
                <FileCheck2 size={16} />
              </span>
              <span>
                <b>COC certificate</b>
                <small>Chain of custody PDF template</small>
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={activeTab === 'notifications' ? 'active' : ''}
            >
              <span className="settings-tab-icon">
                <Bell size={16} />
              </span>
              <span>
                <b>{t('settings.tabs.notifications.title') || 'Notifications'}</b>
                <small>{t('settings.tabs.notifications.subtitle') || 'Alert preferences'}</small>
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={activeTab === 'preferences' ? 'active' : ''}
            >
              <span className="settings-tab-icon">
                <Globe size={16} />
              </span>
              <span>
                <b>{t('settings.tabs.preferences.title') || 'Preferences'}</b>
                <small>{t('settings.tabs.preferences.subtitle') || 'Language and appearance'}</small>
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            {me?.isPlatformAdmin && (
              <button
                onClick={() => setActiveTab('companies')}
                className={activeTab === 'companies' ? 'active' : ''}
              >
                <span className="settings-tab-icon">
                  <Network size={16} />
                </span>
                <span>
                  <b>Companies</b>
                  <small>Onboard companies onto the platform</small>
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            )}
          </div>

          <div className="settings-content">
            {activeTab === 'organization' && (
              <>
                <div className="settings-section-heading">
                  <div>
                    <h2>{t('settings.organization.title') || 'Organization Details'}</h2>
                    <p>{t('settings.organization.subtitle') || 'Manage your company profile and settings'}</p>
                  </div>
                  {canManageOrg && (
                    <span className="settings-access-badge">
                      {t('settings.organization.adminAccess') || 'Admin Access'}
                    </span>
                  )}
                </div>

                <div className="settings-form-card">
                  <div className="settings-section-heading">
                    <div>
                      <h3>{t('settings.organization.companyInfo') || 'Company Information'}</h3>
                      <p>{t('settings.organization.companyInfoDesc') || 'Basic details about your organization'}</p>
                    </div>
                  </div>
                  <div className="settings-form-grid">
                    <div className="field">
                      <span>{t('settings.organization.companyName') || 'Company Name'}</span>
                      <input type="text" value={me?.org.name ?? ''} disabled />
                    </div>
                    <div className="field">
                      <span>{t('settings.organization.orgId') || 'Organization ID'}</span>
                      <input type="text" value={orgId || 'Loading...'} disabled />
                    </div>
                    <div className="field">
                      <span>Country</span>
                      <input type="text" value={findCountry(orgSettings.country)?.name ?? orgSettings.country ?? ''} disabled />
                    </div>
                    <div className="field">
                      <span>Currency · time zone</span>
                      <input type="text" value={[orgSettings.currency, orgSettings.timezone].filter(Boolean).join(' · ')} disabled />
                    </div>
                    <div className="field">
                      <span>Support contact</span>
                      <input type="text" value={orgBranding.support_phone || orgBranding.whatsapp || ''} disabled />
                    </div>
                    <div className="field">
                      <span>Job references</span>
                      <input type="text" value={orgSettings.job_ref_prefix ? `${orgSettings.job_ref_prefix}-0001` : ''} disabled />
                    </div>
                    {me && (
                      <div className="field wide">
                        <span>Public booking page</span>
                        <a href={me.publicUrl} target="_blank" rel="noopener noreferrer" className="onb-link">{me.publicUrl} <ExternalLink size={12} /></a>
                      </div>
                    )}
                  </div>
                  {canManageOrg && (
                    <div className="settings-form-footer">
                      <button className="primary" onClick={() => navigate('/onboarding')}>
                        Edit company profile
                      </button>
                    </div>
                  )}
                </div>

                {me && !me.isPlatformAdmin && (
                  <div className="settings-form-card">
                    <div className="settings-section-heading">
                      <div>
                        <h3>Your own domain</h3>
                        <p>Serve your booking and tracking pages on your own address, e.g. book.yourcompany.com.</p>
                      </div>
                    </div>
                    <DomainCard canEdit={canManageOrg} />
                  </div>
                )}

                {canManageOrg && (
                  <div className="settings-audit-note">
                    <SettingsIcon size={16} />
                    <div>
                      <b>{t('settings.organization.auditNote') || 'Configuration Audit'}</b>
                      <p>{t('settings.organization.auditDesc') || 'All organization changes are logged and accessible to admins'}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'coc' && (
              <>
                <div className="settings-section-heading">
                  <div>
                    <h2>COC certificate</h2>
                    <p>The Chain of Custody PDF your dispatch team and your clients download. Changes apply to every certificate issued after you save.</p>
                  </div>
                </div>
                <div className="settings-form-card">
                  <CocTemplateCard orgId={orgId} canEdit={canManageOrg} />
                </div>
              </>
            )}

            {activeTab === 'notifications' && (
              <>
                <div className="settings-section-heading">
                  <div>
                    <h2>{t('settings.notifications.title') || 'Notification Settings'}</h2>
                    <p>{t('settings.notifications.subtitle') || 'Manage how you receive alerts and updates'}</p>
                  </div>
                </div>

                <PushSettingsCard orgId={orgId} />

                <div className="settings-form-card">
                  <div className="settings-section-heading">
                    <div>
                      <h3>{t('settings.notifications.emailAlerts') || 'Email Alerts'}</h3>
                      <p>{t('settings.notifications.emailAlertsDesc') || 'Receive notifications via email'}</p>
                    </div>
                  </div>
                  <div className="notification-settings-list">
                    <label>
                      <span>
                        <b>{t('settings.notifications.criticalAlerts') || 'Critical operational alerts'}</b>
                        <small>{t('settings.notifications.criticalAlertsDesc') || 'SLA breaches, failed deliveries, and urgent issues'}</small>
                      </span>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label>
                      <span>
                        <b>{t('settings.notifications.jobUpdates') || 'Job status updates'}</b>
                        <small>{t('settings.notifications.jobUpdatesDesc') || 'Pickup confirmations, deliveries, and completions'}</small>
                      </span>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label>
                      <span>
                        <b>{t('settings.notifications.quoteRequests') || 'New quote requests'}</b>
                        <small>{t('settings.notifications.quoteRequestsDesc') || 'Incoming rate and delivery requests from customers'}</small>
                      </span>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label>
                      <span>
                        <b>{t('settings.notifications.driverActivity') || 'Driver activity'}</b>
                        <small>{t('settings.notifications.driverActivityDesc') || 'New applications, document uploads, and status changes'}</small>
                      </span>
                      <input type="checkbox" />
                    </label>
                    <label>
                      <span>
                        <b>{t('settings.notifications.teamChanges') || 'Team changes'}</b>
                        <small>{t('settings.notifications.teamChangesDesc') || 'New members, role updates, and access changes'}</small>
                      </span>
                      <input type="checkbox" />
                    </label>
                  </div>
                </div>

                <div className="settings-form-card">
                  <div className="settings-section-heading">
                    <div>
                      <h3>{t('settings.notifications.systemStatus') || 'System Status'}</h3>
                      <p>{t('settings.notifications.systemStatusDesc') || 'Platform health and maintenance notifications'}</p>
                    </div>
                  </div>
                  <div className="notification-settings-list">
                    <label>
                      <span>
                        <b>{t('settings.notifications.maintenance') || 'Scheduled maintenance'}</b>
                        <small>{t('settings.notifications.maintenanceDesc') || 'Advance notice of planned downtime'}</small>
                      </span>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label>
                      <span>
                        <b>{t('settings.notifications.productUpdates') || 'Product updates'}</b>
                        <small>{t('settings.notifications.productUpdatesDesc') || 'New features and improvements'}</small>
                      </span>
                      <input type="checkbox" defaultChecked />
                    </label>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'preferences' && (
              <>
                <div className="settings-section-heading">
                  <div>
                    <h2>{t('settings.preferences.title') || 'Personal Preferences'}</h2>
                    <p>{t('settings.preferences.subtitle') || 'Customize your dashboard experience'}</p>
                  </div>
                </div>

                <div className="settings-form-card">
                  <div className="settings-section-heading">
                    <div>
                      <h3>{t('settings.preferences.appearance') || 'Appearance'}</h3>
                      <p>{t('settings.preferences.appearanceDesc') || 'Choose your preferred color scheme'}</p>
                    </div>
                  </div>
                  <div className="settings-form-grid">
                    <div className="field wide">
                      <span>{t('settings.preferences.theme') || 'Theme'}</span>
                      <div className="toggle">
                        <button
                          onClick={() => onThemeChange('dark')}
                          className={theme === 'dark' ? 'active' : ''}
                        >
                          <Moon size={12} style={{ marginRight: '4px' }} />
                          {t('settings.preferences.dark') || 'Dark'}
                        </button>
                        <button
                          onClick={() => onThemeChange('light')}
                          className={theme === 'light' ? 'active' : ''}
                        >
                          <Sun size={12} style={{ marginRight: '4px' }} />
                          {t('settings.preferences.light') || 'Light'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="settings-form-card">
                  <div className="settings-section-heading">
                    <div>
                      <h3>{t('settings.preferences.language') || 'Language & Region'}</h3>
                      <p>{t('settings.preferences.languageDesc') || 'Set your preferred language and formats'}</p>
                    </div>
                  </div>
                  <div className="settings-form-grid">
                    <div className="field">
                      <span>{t('settings.preferences.displayLanguage') || 'Display Language'}</span>
                      <select
                        value={i18n.language}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                      >
                        <option value="en">English</option>
                        <option value="ar">العربية (Arabic)</option>
                      </select>
                    </div>
                    <div className="field">
                      <span>{t('settings.preferences.timezone') || 'Timezone'}</span>
                      <select>
                        <option>Asia/Dubai (GST +4:00)</option>
                        <option>Asia/Riyadh (AST +3:00)</option>
                        <option>Europe/London (GMT +0:00)</option>
                        <option>America/New_York (EST -5:00)</option>
                      </select>
                    </div>
                    <div className="field">
                      <span>{t('settings.preferences.dateFormat') || 'Date Format'}</span>
                      <select>
                        <option>DD/MM/YYYY</option>
                        <option>MM/DD/YYYY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div className="field">
                      <span>{t('settings.preferences.timeFormat') || 'Time Format'}</span>
                      <select>
                        <option>24-hour</option>
                        <option>12-hour (AM/PM)</option>
                      </select>
                    </div>
                  </div>
                  <div className="settings-form-footer">
                    <button className="primary">
                      {t('settings.preferences.saveChanges') || 'Save Changes'}
                    </button>
                  </div>
                </div>

                <AccountSettings />
              </>
            )}

            {activeTab === 'companies' && me?.isPlatformAdmin && <CompaniesPanel />}
          </div>
        </div>
      </div>
    </>
  );
}
