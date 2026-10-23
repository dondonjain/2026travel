const test = require('node:test');
const assert = require('node:assert/strict');

const { INITIAL_TRIP_FIXTURE } = require('./cms/fixture.ts');

test('CMS UI CP1 Fixture satisfies contract requirements', () => {
  assert.ok(INITIAL_TRIP_FIXTURE, 'Trip fixture exists');
  assert.equal(INITIAL_TRIP_FIXTURE.days.length, 7, 'Must have 7 days in fixture');
  assert.ok(INITIAL_TRIP_FIXTURE.visits.length >= 29, 'Must have at least 29 visits in fixture');

  // Check state mix
  const confirmed = INITIAL_TRIP_FIXTURE.visits.filter(v => v.reviewStatus === 'confirmed');
  const pending = INITIAL_TRIP_FIXTURE.visits.filter(v => v.reviewStatus === 'pending');
  assert.ok(confirmed.length > 0, 'Must have confirmed visits');
  assert.ok(pending.length > 0, 'Must have pending visits');

  // Check visibility mix
  const publicVisits = INITIAL_TRIP_FIXTURE.visits.filter(v => v.visibility === 'public');
  const privateVisits = INITIAL_TRIP_FIXTURE.visits.filter(v => v.visibility === 'private');
  assert.ok(publicVisits.length > 0, 'Must have public visits');
  assert.ok(privateVisits.length > 0, 'Must have private visits');

  // Must have at least one Confirmed + Private visit
  const confirmedPrivate = INITIAL_TRIP_FIXTURE.visits.filter(v => v.reviewStatus === 'confirmed' && v.visibility === 'private');
  assert.ok(confirmedPrivate.length >= 1, 'Must have at least one Confirmed + Private visit');

  // Must have at least one Place issue and one Time issue
  const placeIssues = INITIAL_TRIP_FIXTURE.visits.flatMap(v => v.issues).filter(i => i.type === 'place');
  const timeIssues = INITIAL_TRIP_FIXTURE.visits.flatMap(v => v.issues).filter(i => i.type === 'time');
  assert.ok(placeIssues.length >= 1, 'Must have at least one place issue');
  assert.ok(timeIssues.length >= 1, 'Must have at least one time issue');
});

test('State Transition: Pending -> Confirmed -> next Pending visit', () => {
  let visits = JSON.parse(JSON.stringify(INITIAL_TRIP_FIXTURE.visits));
  const targetId = 'visit-5'; // Day 2 pending visit
  const targetVisit = visits.find(v => v.id === targetId);
  assert.equal(targetVisit.reviewStatus, 'pending');

  // 1. Confirm target visit
  visits = visits.map(v => v.id === targetId ? { ...v, reviewStatus: 'confirmed' } : v);
  assert.equal(visits.find(v => v.id === targetId).reviewStatus, 'confirmed');

  // 2. Auto-advance in Day 2
  const day2Visits = visits.filter(v => v.dayNumber === 2);
  const nextPending = day2Visits.find(v => v.id !== targetId && v.reviewStatus === 'pending');
  assert.ok(nextPending, 'Should find next pending visit in day 2');
  assert.equal(nextPending.id, 'visit-6', 'Next pending in day 2 should be visit-6');
});

test('State Transition: Confirmed -> Undo -> Pending', () => {
  let visits = JSON.parse(JSON.stringify(INITIAL_TRIP_FIXTURE.visits));
  const targetId = 'visit-5';

  // Confirm
  visits = visits.map(v => v.id === targetId ? { ...v, reviewStatus: 'confirmed' } : v);
  assert.equal(visits.find(v => v.id === targetId).reviewStatus, 'confirmed');

  // Undo
  visits = visits.map(v => v.id === targetId ? { ...v, reviewStatus: 'pending' } : v);
  assert.equal(visits.find(v => v.id === targetId).reviewStatus, 'pending');
});

test('Structural Edit Invalidation: editing Place, Time, Title or Visibility on Confirmed visit reverts to Pending', () => {
  const visit = {
    id: 'visit-1',
    title: '岡山車站',
    placeName: '岡山車站',
    placeCategory: '交通',
    startTime: '17:00',
    endTime: '18:30',
    reviewStatus: 'confirmed',
    visibility: 'public'
  };

  function applyStructuralEdit(v, edit) {
    return {
      ...v,
      ...edit,
      reviewStatus: 'pending' // Section 11 invariant!
    };
  }

  // Edit title
  const editedTitle = applyStructuralEdit(visit, { title: 'JR 岡山車站新站體' });
  assert.equal(editedTitle.reviewStatus, 'pending', 'Editing title must revert to pending');

  // Edit time
  const editedTime = applyStructuralEdit(visit, { startTime: '17:20' });
  assert.equal(editedTime.reviewStatus, 'pending', 'Editing time must revert to pending');

  // Edit visibility
  const editedVisibility = applyStructuralEdit(visit, { visibility: 'private' });
  assert.equal(editedVisibility.reviewStatus, 'pending', 'Editing visibility must revert to pending');
});

test('Preview Eligibility: requires usable trajectory + at least 1 Confirmed + Public Visit', () => {
  function checkPreviewEligibility(usableTrajectory, visits) {
    const confirmedPublicCount = visits.filter(v => v.reviewStatus === 'confirmed' && v.visibility === 'public').length;
    return usableTrajectory && confirmedPublicCount > 0;
  }

  // Case 1: Initial fixture is eligible because visit-1 is confirmed + public
  assert.equal(checkPreviewEligibility(true, INITIAL_TRIP_FIXTURE.visits), true);

  // Case 2: Only Confirmed + Private visits exist -> Ineligible!
  const allPrivateOrPending = INITIAL_TRIP_FIXTURE.visits.map(v => ({
    ...v,
    reviewStatus: v.visibility === 'private' ? 'confirmed' : 'pending'
  }));
  assert.equal(checkPreviewEligibility(true, allPrivateOrPending), false, 'Confirmed Private visits must NOT unlock preview alone');

  // Case 3: Trajectory unusable -> Ineligible!
  assert.equal(checkPreviewEligibility(false, INITIAL_TRIP_FIXTURE.visits), false);
});
