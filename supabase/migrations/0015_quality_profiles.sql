-- Wouri 0015: quality profiles for every commodity (registry Layer 2, cited)
-- Quality attributes are effective-dated reference data (ADR-0002), one pack
-- version per commodity, seeded from the real export standards. Ranges are the
-- typical export thresholds and stay PROVISIONAL under ADR-0030 until validated
-- against a genuine certificate of analysis. Sources per commodity in comments.
-- Cocoa is already seeded (0011). No em-dashes.
--
-- Sources: coffee ISO 4150 (size), ISO 6673 (moisture), ICO/SCA defect grading.
-- palm oil PORAM/MPOA + MS 814 (FFA, M&I, DOBI, iodine value). rubber ISO 2000
-- (dirt, ash, nitrogen, volatile matter, Po, PRI). cotton USDA HVI classing
-- (micronaire, staple, strength, uniformity, trash). banana Codex STAN 205 and
-- EU 1333/2011 (finger length, grade/caliber, quality class).

insert into quality_attributes (commodity_id, key, label_fr, label_en, datatype, unit, min_value, max_value, pack_version)
select c.id, v.key, v.label_fr, v.label_en, v.datatype, v.unit, v.min_value, v.max_value, v.pack_version
from (values
  -- coffee
  ('coffee','moisture','Humidite','Moisture','numeric','%',9::numeric,13::numeric,'coffee-v1'),
  ('coffee','screen_size','Calibre','Screen size','numeric','1/64 in',12,18,'coffee-v1'),
  ('coffee','defect_count','Nombre de defauts','Defect count','numeric','/300g',0,86,'coffee-v1'),
  -- palm oil (crude, CPO)
  ('palm_oil','ffa','Acidite (AGL)','Free fatty acid','numeric','% palmitique',0,5,'palm-v1'),
  ('palm_oil','moisture_impurities','Humidite et impuretes','Moisture and impurities','numeric','%',0,0.25,'palm-v1'),
  ('palm_oil','dobi','Indice DOBI','DOBI','numeric','index',2.3,3.5,'palm-v1'),
  ('palm_oil','iodine_value','Indice d''iode','Iodine value','numeric','gI2/100g',49,56,'palm-v1'),
  -- rubber (TSR)
  ('rubber','dirt','Impuretes','Dirt content','numeric','%',0,0.16,'rubber-v1'),
  ('rubber','ash','Cendres','Ash content','numeric','%',0,1.0,'rubber-v1'),
  ('rubber','nitrogen','Azote','Nitrogen','numeric','%',0,0.6,'rubber-v1'),
  ('rubber','volatile_matter','Matieres volatiles','Volatile matter','numeric','%',0,0.8,'rubber-v1'),
  ('rubber','po_plasticity','Plasticite Po','Plasticity Po','numeric','Wallace',30,null,'rubber-v1'),
  ('rubber','pri','Indice de retention de plasticite','Plasticity retention index','numeric','%',40,100,'rubber-v1'),
  -- cotton (HVI)
  ('cotton','micronaire','Micronaire','Micronaire','numeric','mic',3.5,4.9,'cotton-v1'),
  ('cotton','staple_length','Longueur de fibre','Staple length','numeric','mm',28,40,'cotton-v1'),
  ('cotton','strength','Tenacite','Strength','numeric','g/tex',28,40,'cotton-v1'),
  ('cotton','uniformity_index','Indice d''uniformite','Uniformity index','numeric','%',80,100,'cotton-v1'),
  ('cotton','trash','Dechets','Trash','numeric','%',0,5,'cotton-v1'),
  -- banana (Codex STAN 205 / EU 1333/2011)
  ('banana','finger_length','Longueur du doigt','Finger length','numeric','cm',14,null,'banana-v1'),
  ('banana','grade_caliber','Calibre','Grade (caliber)','numeric','mm',27,null,'banana-v1'),
  ('banana','quality_class','Classe','Quality class','text',null,null,null,'banana-v1'),
  -- timber (sawnwood air-dry moisture; grade and species live in the spine)
  ('timber','moisture','Humidite','Moisture','numeric','%',0,20,'timber-v1')
) as v(commodity_key, key, label_fr, label_en, datatype, unit, min_value, max_value, pack_version)
join commodities c on c.key = v.commodity_key
where not exists (
  select 1 from quality_attributes qa where qa.commodity_id = c.id and qa.key = v.key
);
