import json

from app.equipment_registry import REGISTRY_DIR
from app.scenarios import SCENARIO_BY_ID


def test_training_mappings_reference_existing_content_and_sources():
    data = json.loads((REGISTRY_DIR / 'training.json').read_text(encoding='utf-8'))
    assert data['schemaVersion'] == 1
    domains = {domain['id'] for domain in data['domains']}
    assert domains == {'fundamentals', 'electrical', 'airflow', 'installation', 'service'}
    sources = {source['id'] for source in data['sources']}
    covered = set()
    for skill in data['skills']:
        assert skill['domain'] in domains
        assert set(skill['sourceIds']) <= sources
        assert skill['sourceIds'] and skill['scenarioIds']
        assert len(skill['scenarioIds']) == len(set(skill['scenarioIds']))
        assert set(skill['scenarioIds']) <= SCENARIO_BY_ID.keys()
        covered.update(skill['scenarioIds'])
    assert covered == SCENARIO_BY_ID.keys()
    assert data['epaPracticalScenarioIds'] == ['c-608-drier']
    assert all(domain['gap'] for domain in data['domains'])
