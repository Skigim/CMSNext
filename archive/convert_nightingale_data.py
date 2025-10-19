#!/usr/bin/env python3
"""
Script to convert Nightingale data format to a direct array of cases.

This script reads nightingale-data.json and converts it to an array of complete
case objects (combining person and case data) that match the expected format
for the case tracking platform.

Key corrections:
- Uses 'zip' instead of 'zipCode' in addresses
- Uses 'applicationDate' and 'updatedDate' instead of 'dateOpened' and 'lastUpdated'
- Uses boolean values for priority instead of strings
- Includes all required fields with proper defaults
- Normalizes status values to valid enum values
"""

import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional


def load_json_file(file_path: str) -> Dict[str, Any]:
    """Load and parse a JSON file."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)


def save_json_file(data: List[Dict[str, Any]], file_path: str) -> None:
    """Save data to a JSON file with proper formatting."""
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=2, ensure_ascii=False)


def find_person_by_id(people: List[Dict], person_id: str) -> Optional[Dict]:
    """Find a person by their ID."""
    for person in people:
        if person.get('id') == person_id:
            return person
    return None


def find_organization_by_id(organizations: List[Dict], org_id: str) -> Optional[Dict]:
    """Find an organization by its ID."""
    for org in organizations:
        if org.get('id') == org_id:
            return org
    return None


def normalize_status(status: str) -> str:
    """Normalize status to match expected enum values."""
    if not status:
        return 'In Progress'
    
    status_lower = status.lower()
    
    if 'progress' in status_lower or 'active' in status_lower or 'open' in status_lower:
        return 'In Progress'
    elif 'priority' in status_lower or 'urgent' in status_lower:
        return 'Priority'
    elif 'review' in status_lower or 'pending' in status_lower:
        return 'Review'
    elif 'complete' in status_lower or 'closed' in status_lower or 'done' in status_lower or 'denied' in status_lower:
        return 'Completed'
    else:
        return 'In Progress'


def generate_id(prefix: str = '') -> str:
    """Generate a unique ID."""
    return f"{prefix}{uuid.uuid4()}"


def normalize_date(date_str: str) -> str:
    """Normalize date string to ISO format."""
    if not date_str:
        return datetime.now().isoformat()
    
    try:
        # Try to parse various date formats
        if 'T' in date_str:
            # Already in ISO format
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            # Try parsing as date only
            dt = datetime.strptime(date_str, '%Y-%m-%d')
        
        return dt.isoformat()
    except:
        # If parsing fails, return current time
        return datetime.now().isoformat()


def convert_person_data(person: Dict, organizations: List[Dict]) -> Dict[str, Any]:
    """Convert person data from Nightingale format to expected format."""
    
    # Parse address information
    address = person.get('address', {})
    
    # Convert date of birth to simpler format if available
    date_of_birth = person.get('dateOfBirth', '')
    if date_of_birth:
        try:
            # Convert ISO datetime to date string
            dt = datetime.fromisoformat(date_of_birth.replace('Z', '+00:00'))
            date_of_birth = dt.strftime('%Y-%m-%d')
        except:
            # Keep original if parsing fails
            pass
    
    # Ensure person has required ID
    person_id = person.get('id') or generate_id('person-')
    first_name = person.get('firstName', '')
    last_name = person.get('lastName', '')
    full_name = f"{first_name} {last_name}".strip()
    
    current_time = datetime.now().isoformat()
    
    converted_person = {
        "id": person_id,
        "firstName": first_name,
        "lastName": last_name,
        "name": full_name,
        "email": person.get('email', ''),
        "phone": person.get('phone', ''),
        "dateOfBirth": date_of_birth,
        "ssn": person.get('ssn', ''),
        "organizationId": person.get('organizationId'),  # Can be null
        "livingArrangement": person.get('livingArrangement', 'Independent'),
        
        # Address - note 'zip' not 'zipCode'
        "address": {
            "street": address.get('street', ''),
            "city": address.get('city', ''),
            "state": address.get('state', ''),
            "zip": address.get('zip', address.get('zipCode', ''))  # Handle both formats
        },
        
        # Mailing address - required field
        "mailingAddress": {
            "street": address.get('street', ''),
            "city": address.get('city', ''),
            "state": address.get('state', ''),
            "zip": address.get('zip', address.get('zipCode', '')),
            "sameAsPhysical": True
        },
        
        # Required array fields
        "authorizedRepIds": person.get('authorizedRepIds', []),
        "familyMembers": person.get('familyMembers', []),
        "status": person.get('status', 'Active'),
        "createdAt": normalize_date(person.get('createdAt', '')),
        "dateAdded": normalize_date(person.get('dateAdded', person.get('createdAt', '')))
    }
    
    return converted_person


def convert_financial_items(financial_items: List[Dict], item_type: str) -> List[Dict]:
    """Convert financial items (resources, income, expenses) to the target format."""
    converted_items = []
    
    for item in financial_items:
        item_id = item.get('id') or generate_id(f'{item_type}-')
        current_time = datetime.now().isoformat()
        
        converted_item = {
            "id": item_id,
            "description": item.get('description', item.get('name', '')),
            "location": item.get('location', ''),
            "accountNumber": item.get('accountNumber', ''),
            "amount": float(item.get('amount', 0)),
            "frequency": item.get('frequency', 'Monthly'),
            "owner": item.get('owner', ''),
            "verificationStatus": item.get('verificationStatus', 'Needs VR'),
            "verificationSource": item.get('verificationSource', ''),
            "notes": item.get('notes', ''),
            "dateAdded": normalize_date(item.get('dateAdded', item.get('createdAt', ''))),
            "createdAt": normalize_date(item.get('createdAt', '')),
            "updatedAt": normalize_date(item.get('updatedAt', item.get('createdAt', '')))
        }
        
        converted_items.append(converted_item)
    
    return converted_items


def convert_notes(notes: List[Dict]) -> List[Dict]:
    """Convert notes to the expected format."""
    converted_notes = []
    
    for note in notes:
        note_id = note.get('id') or generate_id('note-')
        
        converted_note = {
            "id": note_id,
            "category": note.get('category', 'General'),
            "content": note.get('content', note.get('text', '')),
            "createdAt": normalize_date(note.get('createdAt', '')),
            "updatedAt": normalize_date(note.get('updatedAt', note.get('createdAt', '')))
        }
        converted_notes.append(converted_note)
    
    return converted_notes


def convert_case_data(case: Dict, person: Dict, organizations: List[Dict]) -> Dict[str, Any]:
    """Convert case data from Nightingale format to expected format."""
    
    # Ensure case has required ID
    case_id = case.get('id') or generate_id('case-record-')
    person_id = person.get('id') or generate_id('person-')
    
    # Get financials
    financials = case.get('financials', {})
    
    # Convert notes
    notes = convert_notes(case.get('notes', []))
    
    # Normalize dates
    application_date = normalize_date(case.get('applicationDate', case.get('dateOpened', '')))
    updated_date = normalize_date(case.get('updatedDate', case.get('lastUpdated', '')))
    created_date = normalize_date(case.get('createdDate', case.get('createdAt', application_date)))
    
    converted_case = {
        "id": case_id,
        "personId": person_id,
        "mcn": case.get('mcn', ''),
        "applicationDate": application_date,  # ✅ Correct field name
        "caseType": case.get('caseType', 'General'),
        "spouseId": case.get('spouseId', ''),
        "status": normalize_status(case.get('status', '')),  # ✅ Normalized to valid enum
        "description": case.get('description', ''),
        "priority": bool(case.get('priority', False)),  # ✅ Boolean value
        "livingArrangement": case.get('livingArrangement', person.get('livingArrangement', 'Independent')),
        "withWaiver": bool(case.get('withWaiver', False)),
        "admissionDate": normalize_date(case.get('admissionDate', application_date)),
        "organizationId": case.get('organizationId', ''),
        "authorizedReps": case.get('authorizedReps', []),
        "retroRequested": case.get('retroRequested', ''),
        
        # Financials with proper structure
        "financials": {
            "resources": convert_financial_items(financials.get('resources', []), 'resource'),
            "income": convert_financial_items(financials.get('income', []), 'income'),
            "expenses": convert_financial_items(financials.get('expenses', []), 'expense')
        },
        
        "notes": notes,
        "createdDate": created_date,
        "updatedDate": updated_date  # ✅ Correct field name
    }
    
    return converted_case


def convert_to_multiple_cases_format(nightingale_data: Dict) -> List[Dict[str, Any]]:
    """Convert to multiple cases format using the correct structure."""
    people = nightingale_data.get('people', [])
    cases = nightingale_data.get('caseRecords', nightingale_data.get('cases', []))  # Handle both field names
    organizations = nightingale_data.get('organizations', [])
    
    multiple_cases = []
    
    # Process all cases using the correct structure
    for case in cases:
        person = find_person_by_id(people, case.get('personId', ''))
        if person:
            # Convert both person and case data
            converted_person = convert_person_data(person, organizations)
            converted_case = convert_case_data(case, person, organizations)
            
            # Create the complete case structure
            case_item = {
                "id": generate_id('case-'),  # Top-level case ID
                "name": converted_person["name"],
                "mcn": converted_case["mcn"],
                "status": converted_case["status"],
                "priority": converted_case["priority"],
                "createdAt": converted_case["createdDate"],
                "updatedAt": converted_case["updatedDate"],
                "person": converted_person,
                "caseRecord": converted_case
            }
            multiple_cases.append(case_item)
    
    return multiple_cases


def main():
    """Main conversion function."""
    print("Starting Nightingale data conversion...")
    
    # Load source data
    try:
        nightingale_data = load_json_file('nightingale-data.json')
        people_count = len(nightingale_data.get('people', []))
        cases_count = len(nightingale_data.get('caseRecords', nightingale_data.get('cases', [])))
        print(f"Loaded Nightingale data with {people_count} people and {cases_count} cases")
    except FileNotFoundError:
        print("Error: nightingale-data.json not found")
        return
    except json.JSONDecodeError as e:
        print(f"Error parsing nightingale-data.json: {e}")
        return
    
    # Convert data to multiple cases format (direct array)
    multiple_cases = convert_to_multiple_cases_format(nightingale_data)
    
    # Save converted data directly as an array
    output_file = 'converted-nightingale-data.json'
    save_json_file(multiple_cases, output_file)
    print(f"Conversion completed. Output saved to {output_file}")
    
    # Print summary
    print(f"\nConversion Summary:")
    print(f"- Cases converted: {len(multiple_cases)}")
    print(f"- Output format: Direct array of complete case objects")
    print(f"- Each case includes person data and case record with all required fields")
    
    # Print validation info
    if multiple_cases:
        sample_case = multiple_cases[0]
        print(f"\nSample case structure:")
        print(f"- Case ID: {sample_case.get('id')}")
        print(f"- Person: {sample_case.get('name')}")
        print(f"- MCN: {sample_case.get('mcn')}")
        print(f"- Status: {sample_case.get('status')}")
        print(f"- Priority: {sample_case.get('priority')} (boolean)")
        print(f"- Address zip field: {'zip' if 'zip' in sample_case['person']['address'] else 'zipCode (ERROR)'}")
        print(f"- Has mailingAddress: {'mailingAddress' in sample_case['person']}")
        print(f"- Financial categories: {list(sample_case['caseRecord']['financials'].keys())}")


if __name__ == "__main__":
    main()