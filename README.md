# Case Tracking Platform

A modern, filesystem-based case tracking application built with React, TypeScript, and Tailwind CSS v4. This application provides a comprehensive solution for managing individual cases with full CRUD capabilities, financial tracking, and note management—all stored locally on your device.

<!-- Force rebuild: 2025-09-23 -->

## ✨ Key Features

### 🗂️ **Filesystem-Only Storage**
- **Local-first architecture** using the File System Access API
- **No database or authentication** required—works out of the box
- **Intelligent autosave** with debouncing and conflict resolution  
- **Automatic backups** with timestamped versions
- **100% offline capability** once connected to a directory

### 📋 **Advanced Case Management**
- **Full CRUD operations** for cases, financial items, and notes
- **Smart navigation** with breadcrumb trails and back functionality
- **Real-time search and filtering** across all case data
- **Bulk operations** for efficient data management
- **Priority flagging** and status tracking systems

### 💰 **Comprehensive Financial Tracking**
- **Resources**: Assets, bank accounts, property, investments
- **Income**: Employment, benefits, support with frequency tracking
- **Expenses**: Bills, debts, recurring costs
- **Verification status**: VR (Verified), AVS (Applied/Verified/Stopped), etc.
- **Smart categorization** with customizable types

### 📝 **Rich Notes System**
- **Categorized notes**: General, VR Update, Client Contact, Follow-up, and more
- **Timestamps and edit history** for full audit trails
- **Rich text support** with proper formatting
- **Quick add/edit/delete** functionality with keyboard shortcuts

### 🎨 **Premium UI/UX Experience**
- **6 beautiful themes**: Light, Dark, Soft Dark, Warm, Blue, Paper
- **Monday.com-inspired** workflow and interaction patterns
- **Fully responsive design** optimized for desktop, tablet, and mobile
- **Comprehensive toast notifications** using Sonner for user feedback
- **Accessibility-first** design with proper ARIA labels and keyboard navigation

### 📊 **Intelligent Dashboard**
- **Case overview statistics** with visual indicators
- **Priority case highlighting** for urgent attention
- **Recent activity tracking** with quick access
- **Smart widgets** showing case distribution and trends

### ⚙️ **Advanced Data Management**
- **JSON import/export** with comprehensive validation
- **Data migration tools** for legacy formats
- **Bulk import capabilities** with progress indicators
- **Data integrity checks** and automatic recovery
- **File management** with directory browsing and file loading

## 🌐 Browser Compatibility

This application requires the **File System Access API** for local file operations:

| Browser | Support | Version | Notes |
|---------|---------|---------|-------|
| ✅ **Chrome** | Full Support | 86+ | Recommended |
| ✅ **Edge** | Full Support | 86+ | Recommended |
| ✅ **Opera** | Full Support | 72+ | Full compatibility |
| ❌ **Firefox** | Not Supported | - | API not implemented |
| ❌ **Safari** | Not Supported | - | API not implemented |

**Note**: For unsupported browsers, the application will show a compatibility message with alternative browser recommendations.

## 🚀 Getting Started

### 1. **Initial Setup** (First Time)
1. **Open the application** in a supported browser (Chrome/Edge recommended)
2. **Connect to Directory**: Click "Connect to Folder" when prompted
3. **Choose a location**: Select or create a dedicated folder for your case data
4. **Grant permissions**: Allow read/write access to the selected directory
5. **Ready to go**: The application will initialize automatically

### 2. **First Case Creation**
- Click the **"New Case"** button in the sidebar or dashboard
- Fill in the **person details** (name, MCN, contact info)
- Add **case information** (status, priority, dates)
- **Save** to create your first case

### 3. **Existing Users**
- **Automatic recognition**: The app detects previous directory connections
- **One-click restore**: Click "Connect to Existing" to reconnect
- **Data loading**: Choose from available data files in your directory

### 4. **Data Import** (Optional)
- Navigate to **Settings → Data Management**
- **Upload JSON files** from other case management systems
- **Automatic validation** ensures data integrity
- **Bulk import** with progress tracking and error handling

## 📁 File Structure

When you connect to a directory, the application creates and manages:

```
your-chosen-directory/
├── case-tracker-data.json                    # Main case data file
├── case-tracker-data.backup-[timestamp].json # Automatic timestamped backups
├── imported-data-[timestamp].json            # Imported data files
└── [custom-filename].json                    # Any additional data files
```

### **File Management Features**
- **Automatic backups** created before major operations
- **Timestamped files** for easy chronological tracking
- **Smart file detection** displays all JSON files in your directory
- **File browser** lets you load data from any available file
- **Data validation** ensures file integrity before loading

## 💾 Data Format

Case data is stored in a structured JSON format optimized for performance and data integrity:

```json
{
  "exported_at": "2024-12-19T15:30:00.000Z",
  "total_cases": 2,
  "cases": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "John Doe",
      "mcn": "MC001234",
      "status": "In Progress",
      "priority": false,
      "person": {
        "firstName": "John",
        "lastName": "Doe",
        "dateOfBirth": "1985-03-15",
        "address": {
          "street": "123 Main St",
          "city": "Springfield",
          "state": "IL",
          "zipCode": "62701"
        },
        "phone": "(555) 123-4567",
        "email": "john.doe@email.com"
      },
      "caseRecord": {
        "openDate": "2024-12-01",
        "status": "In Progress",
        "priority": false,
        "financials": {
          "resources": [
            {
              "id": "res_001",
              "description": "Checking Account",
              "amount": 2500.00,
              "frequency": "one-time",
              "verificationStatus": "VR",
              "dateAdded": "2024-12-01T10:00:00.000Z"
            }
          ],
          "income": [
            {
              "id": "inc_001", 
              "description": "Employment",
              "amount": 3200.00,
              "frequency": "monthly",
              "verificationStatus": "VR",
              "dateAdded": "2024-12-01T10:00:00.000Z"
            }
          ],
          "expenses": [
            {
              "id": "exp_001",
              "description": "Rent",
              "amount": 1200.00,
              "frequency": "monthly",
              "verificationStatus": "VR",
              "dateAdded": "2024-12-01T10:00:00.000Z"
            }
          ]
        },
        "notes": [
          {
            "id": "note_001",
            "category": "General",
            "content": "Initial intake completed",
            "createdAt": "2024-12-01T10:00:00.000Z",
            "updatedAt": "2024-12-01T10:00:00.000Z"
          }
        ]
      }
    }
  ]
}
```

### **Data Validation**
- **Automatic migration** from legacy formats
- **Schema validation** ensures data consistency  
- **Type checking** prevents data corruption
- **Backup creation** before any destructive operations

## 🛠️ Technology Stack

### **Core Technologies**
- **React 18** with TypeScript for type-safe component development
- **Tailwind CSS v4** for utility-first styling with custom design tokens
- **File System Access API** for native filesystem integration
- **Vite** for lightning-fast development and optimized builds

### **UI & Design System**
- **shadcn/ui** - High-quality, accessible component library
- **Lucide React** - Beautiful, consistent iconography
- **Sonner** - Elegant toast notifications with stacking
- **Custom theme system** - 6 carefully crafted themes with smooth transitions

### **State Management & Data**
- **React Context** for global state management
- **Custom hooks** for encapsulated business logic
- **Intelligent autosave** with debouncing and conflict resolution
- **File-based persistence** with automatic backup and recovery

### **Developer Experience**
- **TypeScript strict mode** for maximum type safety
- **Component-driven architecture** with clear separation of concerns
- **Custom utilities** for data transformation and validation
- **Comprehensive error handling** with user-friendly messaging

## 🏗️ Architecture

The application follows a **clean, filesystem-only architecture** designed for privacy, performance, and simplicity:

### **Core Principles**
- **🔒 Privacy-First**: All data remains on your local device
- **⚡ Performance-Optimized**: No network requests, instant responses
- **🎯 Single Responsibility**: Each component has a clear, focused purpose
- **🔄 Reactive Design**: Real-time UI updates with efficient state management

### **Architecture Layers**

```
┌─────────────────────────────────────────┐
│              Presentation Layer          │
│  ┌─────────────┐ ┌─────────────────────┐ │
│  │  UI Components │ │  Theme System      │ │
│  │  (shadcn/ui)   │ │  (6 Themes)        │ │
│  └─────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│               Business Layer             │
│  ┌─────────────┐ ┌─────────────────────┐ │
│  │ Custom Hooks  │ │  State Management  │ │
│  │ (useCases)    │ │  (React Context)   │ │
│  └─────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│                Data Layer                │
│  ┌─────────────┐ ┌─────────────────────┐ │
│  │ FileStorageAPI│ │  AutosaveService   │ │
│  │ (CRUD Ops)    │ │  (File Management) │ │
│  └─────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│              Storage Layer               │
│  ┌─────────────────────────────────────┐ │
│  │      File System Access API         │ │
│  │     (Browser Native Storage)        │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### **Key Architectural Decisions**
- **No Authentication Required**: Direct access without login complexity
- **No Database Dependencies**: Eliminates server infrastructure needs  
- **No Network Requests**: Pure client-side application for maximum privacy
- **Browser-Native Storage**: Leverages modern web platform capabilities

## 💻 Development

The application is designed for **zero-configuration development** with no server setup required:

### **Quick Start**
```bash
# Clone and install dependencies
npm install

# Start development server
npm run dev

# Open in browser (Chrome/Edge recommended)
# Navigate to http://localhost:5173
```

### **Development Features**
- **⚡ Hot Module Replacement** - Instant updates during development
- **🔍 TypeScript Integration** - Full type checking and IntelliSense
- **🎨 Tailwind CSS v4** - Utility-first styling with custom design tokens
- **📱 Responsive Testing** - Built-in device simulation
- **🧪 Component Preview** - Individual component development and testing

### **Project Structure**
```
/src
├── /components          # Reusable UI components
│   ├── /ui             # shadcn/ui base components  
│   └── /modals         # Modal dialogs and overlays
├── /contexts           # React Context providers
├── /hooks              # Custom React hooks (future refactoring)
├── /types              # TypeScript type definitions
├── /utils              # Utility functions and services
└── /styles             # Global CSS and theme definitions
```

### **Code Quality**
- **TypeScript Strict Mode** enabled for maximum type safety
- **Component-driven architecture** with clear separation of concerns
- **Custom hooks pattern** ready for business logic extraction
- **Comprehensive error handling** with user-friendly messaging

## 🔒 Privacy & Security

This application is built with **privacy-by-design** principles:

### **Data Privacy Guarantees**
- **🏠 100% Local Storage**: All case data remains on your device
- **🚫 No Cloud Uploads**: Zero data transmission to external servers
- **🔍 No Tracking**: No analytics, cookies, or user behavior monitoring
- **📡 Offline Capable**: Full functionality without internet connection
- **🔐 No Authentication**: No accounts, passwords, or personal data collection

### **Security Features**
- **Browser-native security**: Leverages File System Access API permissions
- **Data validation**: Input sanitization and type checking
- **Automatic backups**: Protection against data loss
- **Permission control**: You maintain full control over data access

## 📋 Current Status

- **✅ Core Features**: Complete CRUD operations for cases, financial items, and notes
- **✅ File Storage**: Robust autosave with File System Access API integration  
- **✅ UI/UX**: 6 polished themes with responsive design, 100% shadcn/ui migration complete
- **✅ Data Management**: Import/export with validation and migration
- **✅ Testing Infrastructure**: 290 tests passing with vitest + axe accessibility checks
- **✅ Telemetry & Performance**: Production-ready observability and performance tracking
- **✅ Phase 1 Refactor**: Domain-driven architecture foundation with rich entities and repository pattern
- **✅ Phase 2 Refactor**: Event-driven state management with DomainEventBus and ActivityLogger
- **🔄 Phase 3 (Next)**: Hooks migration and use case expansion (November 2025)

### Architecture Progress

**Completed:**
- Domain structure with rich entities (Case, FinancialItem, Note, Alert, ActivityEvent)
- Unified StorageRepository with domain adapters
- ApplicationState singleton with Map-based storage
- DomainEventBus for decoupled event publishing
- ActivityLogger with automatic persistence and rollback
- Use cases: CreateCase, UpdateCase, DeleteCase with optimistic update + rollback patterns

**In Planning:**
- Phase 3: Migrate React hooks to use ApplicationState and domain events
- Phase 4: Alert system integration with event bus
- Phase 5: Worker-ready interfaces for background processing

See `docs/development/architecture-refactor-plan.md` for detailed roadmap.

## 🆘 Support & Compatibility

### **Recommended Setup**
- **Browser**: Chrome 86+ or Edge 86+ (File System Access API required)
- **Platform**: Windows, macOS, or Linux desktop
- **Storage**: Local directory with read/write permissions

### **Troubleshooting**
- **Permission Issues**: Ensure your browser allows file system access
- **Performance**: For large datasets (1000+ cases), consider data archival
- **Browser Support**: Check [File System Access API compatibility](https://caniuse.com/native-filesystem-api)

---

## 🎯 Vision

This application demonstrates the power of **local-first software**—providing professional-grade case management while keeping your data completely under your control. No accounts, no servers, no compromises on privacy.