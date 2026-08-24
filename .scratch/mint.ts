import { mintWorkflowSession } from '../src/lib/workflows/mint-session';
import { operationalDb } from '../src/db';

async function main() {
  const wf = await operationalDb.workflow.findFirst({
    where: { status: 'PUBLISHED', draftConfig: { path: ['subjectType'], equals: 'business' } },
    select: { id: true, orgId: true, environment: true, publicId: true, name: true },
  });
  if (!wf) return console.log('no published KYB workflow');
  const s = await mintWorkflowSession({
    workflowId: wf.publicId, orgId: wf.orgId, environment: wf.environment,
    externalUserId: 'probe_1',
    prefill: {
      userData: { firstName: 'Richard', lastName: 'Ingwe', businessName: 'Kuda' },
      business: { country: 'NG', registrationNumber: 'RC0000001' },
    },
  } as never);
  const row = await operationalDb.handoffSession.findUnique({ where: { id: (s as { id: string }).id } });
  const snap = row!.configSnapshot as Record<string, unknown>;
  console.log('businessPrefill:', JSON.stringify(snap.businessPrefill));
  console.log('userData:', JSON.stringify(snap.userData));
  console.log('token:', row!.token);
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e).slice(0,300)); process.exit(1); });
