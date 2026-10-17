-- Normalize named Scoutbook den labels already shared in PackOps. Keep the
-- original export value for traceability, without deleting or merging Scouts.
-- Number-only labels remain untouched because their den cannot be inferred.
update public.pack_records
set payload=payload || jsonb_build_object(
 'sourceDen',coalesce(payload->>'sourceDen',payload->>'den'),
 'den',case when payload->>'den' ~* '^(AOL|Arrow of Light)[[:space:]]+[0-9]+[[:space:]]*$'
   then 'Arrow of Light'
   else initcap(trim(regexp_replace(payload->>'den','[[:space:]]+[0-9]+[[:space:]]*$','')))
  end
)
where table_name='roster'
 and payload->>'den' ~* '^(Lion|Tiger|Wolf|Bear|Webelos|Arrow of Light|AOL)[[:space:]]+[0-9]+[[:space:]]*$';
