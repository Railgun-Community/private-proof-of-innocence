### Problem:

Pending transact proof stuck on blank-node even with historicalMerklerootsLength matching other nodes

### Solution:

Printed in node-status page
Is a product of TransactProofMempoolCache.getCacheSize()
returns result of getCache().size
getCache() returns a `BlindedCommitmentMap` object representing the specific cache for the given parameters.
transact proofs are added to the mempool using addToCache, and removed using removeFromCache
maybe something ocurred that stopped the removal from happening.
there is removeproofifallotherblindedocmmitmentsadded() and removeproofsigned() in transactproofmempoolpruner class
possible fixes would be if a proof is in the pending cache for long then re-attempt a removal
or check for discrepancy between cache and database
scheduled task to handle stuck pending proofs?
manual trigger?
i believe inflateCacheFromDatabase is called on each node restart which, for every list key, and every transact proof db item, removes proof from mempool if exists and after adds proof to mempool if it doesn't
note: there are multiple addToCache functions, one for transact proof mempoo, legacy, and blocked shields
TransactProofMempool.submitProof is called from the api for submit-transact-proof
it seems a few things could cause an add but failure to remove. maybe a timed check or any check is needed either way to ensure this can't happen several different ways.
