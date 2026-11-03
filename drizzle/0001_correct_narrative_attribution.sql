-- Correct omitted author attribution only for the exact unchanged licensed narrative.
-- Re-running is safe: already attributed sources are excluded.
INSERT INTO audit (id,workspace_id,source_id,action,detail,created_at)
SELECT lower(hex(randomblob(16))),workspace_id,id,'source-attribution-corrected','{"field": "authors", "from": "", "to": "Jabeen Tahira, Amjad Muhammad Shoaib, Ahmad Khalid, Bussmann Rainer W, Qureshi Huma, Vitasović-Kosić Ivana", "basis": "Author names from PMC11124858 article-meta contributor group; source text and SHA-256 unchanged.", "xmlSha256": "9df4e836159c5b5e69a9a4c6d460c86136c37ef6cb159bc7090ce5769f1a293e"}',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM sources WHERE doi='10.3390/plants13101379' AND content_hash='87ae66b77c47a877e1264b96d4491ac3743fb207230d7c93983c5d72d657931b' AND COALESCE(json_extract(payload,'$.authors'),'')='';
UPDATE sources SET payload=json_set(payload,'$.authors','Jabeen Tahira, Amjad Muhammad Shoaib, Ahmad Khalid, Bussmann Rainer W, Qureshi Huma, Vitasović-Kosić Ivana')
WHERE doi='10.3390/plants13101379' AND content_hash='87ae66b77c47a877e1264b96d4491ac3743fb207230d7c93983c5d72d657931b' AND COALESCE(json_extract(payload,'$.authors'),'')='';
