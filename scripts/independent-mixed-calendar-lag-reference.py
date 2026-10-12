"""Enumerated feasibility oracle for two calendars and signed successor-calendar lag.

Inputs and all expected dates/floats are frozen before invoking CMeng. The
independent model enumerates whole-hour work slots and feasible activity pairs;
it neither imports product code nor consumes calculated product answers.
"""
import bisect
import datetime as dt
import hashlib
import json
import pathlib
import random
import secrets
import sys

BASE = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)


def calendar(kind):
    weekdays, intervals = [
        ([0, 1, 2, 3, 4], [(8, 16)]),
        ([0, 1, 2, 3, 4, 5], [(6, 16)]),
        (list(range(7)), [(0, 24)]),
        ([1, 2, 3, 4, 5], [(9, 12), (13, 16)]),
    ][kind]
    holiday = '2026-01-12' if kind == 3 else None
    slots = [day * 24 + hour for day in range(45)
             if (BASE + dt.timedelta(days=day)).weekday() in weekdays
             and (BASE + dt.timedelta(days=day)).date().isoformat() != holiday
             for start, end in intervals for hour in range(start, end)]
    weekly = [{'dayIndex': day + 1, 'intervals': [
        {'start': f'{a:02}:00', 'finish': f'{b:02}:00', 'minutes': (b-a)*60}
        for a, b in intervals] if (day-1) % 7 in weekdays else []}
        for day in range(7)]
    hours = sum(b-a for a, b in intervals)
    return {'calendarId': f'C{kind}', 'name': f'Lag reference calendar {kind}',
            'semanticComplete': True,
            'weeklyWorkMinutes': [sum(x['minutes'] for x in d['intervals']) for d in weekly],
            'weeklyWorkIntervals': weekly,
            'exceptions': [{'isoDate': holiday, 'nonWorking': True, 'workIntervals': []}] if holiday else [],
            'standardDayHours': hours, 'standardWeekHours': hours * len(weekdays),
            'sourceRefs': []}, slots


def shift(slots, event, lag):
    if lag == 0:
        return event
    index = bisect.bisect_left(slots, event)
    assert 0 <= index + lag < len(slots), 'Reference horizon exhausted'
    return slots[index + lag - 1] + 1 if lag > 0 else slots[index + lag]


def iso(hour):
    return (BASE + dt.timedelta(hours=hour)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def main():
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    if (out / 'reference.json').exists():
        raise SystemExit('Refuse to overwrite frozen reference')
    seed = sys.argv[2] if len(sys.argv) > 2 else secrets.token_hex(20)
    rng = random.Random(seed)
    # Fri 16:00 plus eight working hours is Mon 16:00. Reverse eight hours
    # from any weekend instant yields Fri 08:00 on the five-day calendar.
    _, sample = calendar(0)
    assert shift(sample, 8*24+16, 8) == 11*24+16
    assert shift(sample, 10*24+20, -8) == 8*24+8
    # A one-hour activity may have a late start event at Saturday's 16:00
    # closing boundary on the split-shift calendar, with its one working hour
    # on Tuesday 09:00-10:00. The successor-calendar SS+15h limit is Tue 15:00.
    _, split = calendar(3)
    boundary = 9*24+16
    assert shift(sample, boundary, 15) == 12*24+15
    assert shift(split, boundary, 1) == 12*24+10
    # Signed FF/SF lag is a chronological event constraint. When the shifted
    # event is the opening after a zero-work gap, it must stay at that opening;
    # the previous closing has the same working-time coordinate but is earlier
    # in real time and would weaken the relationship.
    monday_nonwork = 11*24+10
    assert shift(split, monday_nonwork, -3) == 9*24+13
    cases = []
    for i in range(120):
        calendars, slots = zip(*(calendar(k) for k in rng.sample(range(4), 2)))
        durations = [rng.randint(1, 24), rng.randint(1, 24)]
        anchor = 24*rng.randint(5, 12)
        kind = ['FS', 'SS', 'FF', 'SF'][i % 4]
        lag = rng.randint(1, 16) * (1 if i % 8 < 4 else -1)
        options = [[(ss[j], ss[j+d-1]+1, j) for j in range(len(ss)-d+1)
                    if ss[j] >= anchor] for ss, d in zip(slots, durations)]
        # Late start is an event bound. At a work closing boundary it can be
        # held until the next opening without consuming any extra work. Early
        # starts remain the first actual work instant. Excluding those boundary
        # events would understate available working-time float.
        late_options = [sorted(oo + [
            (ss[j-1]+1, ss[j+d-1]+1, j) for j in range(1, len(ss)-d+1)
            if ss[j-1]+1 < ss[j] and ss[j-1]+1 >= anchor])
            for oo, ss, d in zip(options, slots, durations)]

        def pair(a, b):
            target = shift(slots[1], a[1 if kind[0] == 'F' else 0], lag)
            if kind[1] == 'S':
                return (a, b) if b[0] >= target else None
            # Preserve the exact shifted chronological finish event. Do not
            # collapse an opening to the previous closing merely because no work
            # occurs in the gap between them.
            finish = max(b[1], target)
            worked = bisect.bisect_left(slots[1], finish) - b[2]
            return (a, (b[0], finish, b[2])) if worked == durations[1] else None

        first = options[0][0]
        second = next(p[1] for b in options[1] if (p := pair(first, b)))
        early = [first, second]
        finish = max(p[1] for p in early)
        feasible = [p for a in late_options[0] if a[1] <= finish
                    for b in options[1] if b[1] <= finish
                    and (p := pair(a, b)) and p[1][1] <= finish]
        assert feasible
        late = [max((p[j] for p in feasible), key=lambda p: (p[0], -p[1])) for j in range(2)]
        expected = [{'activityId': f'A{j}', 'earlyStartIso': iso(early[j][0]),
                     'earlyFinishIso': iso(early[j][1]), 'lateStartIso': iso(late[j][0]),
                     'lateFinishIso': iso(late[j][1]), 'totalFloatHours': late[j][2]-early[j][2],
                     'critical': late[j][2] == early[j][2]} for j in range(2)]
        cases.append({'id': f'MIXED-LAG-{seed[:12]}-{i:03}', 'calendars': calendars,
                      'calendarIds': [c['calendarId'] for c in calendars], 'anchor': iso(anchor),
                      'durations': durations, 'relationships': [[0, 1, kind, lag]],
                      'expected': expected, 'projectFinishIso': iso(finish), 'feasiblePairs': len(feasible)})
    content = (json.dumps({'seed': seed,
        'classification': 'Internal independent generated reference; not external acceptance',
        'scope': 'Two not-started activities, different calendars, FS/SS/FF/SF, signed integer-hour successor-calendar lag, split shift/holiday; no constraints or actual progress.',
        'selfChecks': 4, 'cases': cases}, indent=2)+'\n').encode()
    (out/'reference.json').write_bytes(content)
    (out/'reference.sha256').write_text(hashlib.sha256(content).hexdigest()+'\n')
    print(json.dumps({'cases': len(cases), 'sha256': hashlib.sha256(content).hexdigest()}))


if __name__ == '__main__':
    main()
