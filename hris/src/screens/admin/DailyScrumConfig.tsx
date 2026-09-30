'use client';
import { useEffect, useMemo, useState } from 'react';
import { Save, Sparkles, Search, Users, Calendar } from 'lucide-react';
import {
  useDailyScrumConfig, useSaveDailyScrumConfig, useGenerateScrumDay,
} from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { Avatar } from '../../components/ui/Avatar';
import { initials, avatarColorFor } from '@/lib/session';
import { fmtDate, todayISO } from '../../lib/utils';
import './DailyScrumConfig.css';

export function DailyScrumConfig() {
  const addToast = useStore((s) => s.addToast);
  const { data, isLoading } = useDailyScrumConfig();
  const save = useSaveDailyScrumConfig();
  const generate = useGenerateScrumDay();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [genDate, setGenDate] = useState(todayISO());
  const [dirty, setDirty] = useState(false);

  // Seed local state from the server payload on first load; leave it alone
  // afterwards so the user's in-progress edits survive re-renders.
  useEffect(() => {
    if (!data) return;
    if (dirty) return;
    setSelected(new Set(data.employees.filter((e) => e.dailyScrumIncluded).map((e) => e.id)));
  }, [data, dirty]);

  const filtered = useMemo(() => {
    const src = data?.employees ?? [];
    if (!q.trim()) return src;
    const needle = q.trim().toLowerCase();
    return src.filter(
      (e) =>
        e.fullName.toLowerCase().includes(needle) ||
        (e.employeeIdCode ?? '').toLowerCase().includes(needle) ||
        (e.department ?? '').toLowerCase().includes(needle),
    );
  }, [data, q]);

  const total = data?.employees.length ?? 0;
  const includedCount = selected.size;

  function toggle(id: string) {
    setDirty(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setDirty(true);
    setSelected(new Set((data?.employees ?? []).map((e) => e.id)));
  }

  function selectNone() {
    setDirty(true);
    setSelected(new Set());
  }

  function handleSave() {
    save.mutate([...selected], {
      onSuccess: (r) => {
        setDirty(false);
        addToast({
          kind: 'success',
          title: 'Roster saved',
          body: `${r.included} included, ${r.excluded} excluded. Future generations will use this roster.`,
        });
      },
      onError: (e: Error) => {
        addToast({ kind: 'error', title: 'Save failed', body: e.message });
      },
    });
  }

  function handleGenerate() {
    if (!genDate) return;
    generate.mutate(genDate, {
      onSuccess: (r) => {
        addToast({
          kind: 'success',
          title: 'Scrum board generated',
          body: r.createdEntries === 0
            ? `All rostered employees already have an entry for ${fmtDate(genDate, 'd MMM yyyy')}.`
            : `${r.createdEntries} new ${r.createdEntries === 1 ? 'entry' : 'entries'} created for ${fmtDate(genDate, 'd MMM yyyy')}${r.copiedTasks > 0 ? ` (${r.copiedTasks} tasks carried from prior day)` : ''}.`,
        });
      },
      onError: (e: Error) => {
        addToast({ kind: 'error', title: 'Generation failed', body: e.message });
      },
    });
  }

  return (
    <div className="dsconf">
      <div className="dsconf-head">
        <div>
          <h1>Daily Tracker Configuration</h1>
          <p className="muted">
            Pick the employees who should appear in every future daily scrum board.
            Changes apply from the next generation onward — existing boards are not modified.
          </p>
        </div>
      </div>

      <div className="dsconf-panel">
        <div className="dsconf-panel-head">
          <div className="dsconf-panel-title">
             Generate a scrum board
          </div>
          <p className="muted">
            Creates an entry for every currently-included employee on the chosen date.
            Idempotent — safe to run again after adding a mid-week joiner.
          </p>
        </div>
        <div className="dsconf-generate-row">
          <div className="dsconf-date-wrap">
            <Calendar size={16} />
            <input
              type="date"
              className="dsconf-date-input"
              value={genDate}
              onChange={(e) => setGenDate(e.target.value)}
              aria-label="Date to generate"
            />
          </div>
          <Button
            variant="primary"
            // leadingIcon={<Sparkles size={14} />}
            loading={generate.isPending}
            disabled={includedCount === 0}
            onClick={handleGenerate}
          >
            Generate for {genDate ? fmtDate(genDate, 'd MMM yyyy') : '—'}
          </Button>
        </div>
      </div>

      <div className="dsconf-panel">
        <div className="dsconf-panel-head">
          <div className="dsconf-panel-title">
            <Users size={16} /> Roster ({includedCount} of {total} included)
          </div>
          <div className="dsconf-actions">
            <Button size="sm" variant="ghost" onClick={selectAll}>Select all</Button>
            <Button size="sm" variant="ghost" onClick={selectNone}>Clear</Button>
            <Button
              size="sm"
              variant="primary"
              leadingIcon={<Save size={14} />}
              loading={save.isPending}
              disabled={!dirty}
              onClick={handleSave}
            >
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        </div>

        <div className="dsconf-search">
          <Search size={14} />
          <TextInput
            placeholder="Search by name, employee ID, or department"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="dsconf-loading">Loading employees…</div>
        ) : (
          <div className="dsconf-table">
            <div className="dsconf-thead">
              <div />
              <div>Emp ID</div>
              <div>Employee</div>
              <div>Department</div>
              <div>Designation</div>
            </div>
            {filtered.length === 0 && (
              <div className="dsconf-empty">No employees match your search.</div>
            )}
            {filtered.map((e) => {
              const isOn = selected.has(e.id);
              return (
                <label
                  key={e.id}
                  className={`dsconf-row ${isOn ? 'dsconf-row-on' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(e.id)}
                    className="dsconf-check"
                  />
                  <div className="dsconf-cell dsconf-mono">{e.employeeIdCode ?? '—'}</div>
                  <div className="dsconf-cell dsconf-emp">
                    <Avatar
                      initials={initials(e.fullName)}
                      color={avatarColorFor(e.id)}
                      imageUrl={e.avatarUrl}
                      size="sm"
                    />
                    <span>{e.fullName}</span>
                  </div>
                  <div className="dsconf-cell">{e.department ?? '—'}</div>
                  <div className="dsconf-cell">{e.designation ?? '—'}</div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
