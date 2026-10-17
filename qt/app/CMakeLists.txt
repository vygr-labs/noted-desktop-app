# noted (executable)
#
# Thin QML shell over noted-core: window chrome, the editor bridge
# (EditorController), app services (export/import/hotkey/single instance)
# and the UI.

qt_add_executable(noted WIN32 MACOSX_BUNDLE
    src/main.cpp
    src/AppController.cpp
    src/AppController.h
    src/Zip.cpp
    src/Zip.h
    # Restores Win+Arrow snapping and the taskbar window menu that
    # Qt::FramelessWindowHint takes away. Compiles to nothing elsewhere.
    src/WindowChrome.cpp
    src/WindowChrome.h
    # Input playback for checking the UI (--drive).
    src/DevDriver.cpp
    src/DevDriver.h
)

if(WIN32)
    target_sources(noted PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../packaging/noted.rc)
    # The resource compiler doesn't report the icon it embeds, so a new icon
    # wouldn't rebuild the .exe's without this.
    set_source_files_properties(${CMAKE_CURRENT_SOURCE_DIR}/../packaging/noted.rc PROPERTIES
        OBJECT_DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/../packaging/noted.ico)
endif()

set_source_files_properties(
    qml/Theme.qml
    qml/AppState.qml
    qml/Icons.qml
    PROPERTIES QT_QML_SINGLETON_TYPE TRUE
)

qt_add_qml_module(noted
    URI Noted
    VERSION 1.0
    SOURCES
        src/EditorController.cpp
        src/EditorController.h
        src/OpenFiles.cpp
        src/OpenFiles.h
        src/SpellChecker.cpp
        src/SpellChecker.h
        src/Updater.cpp
        src/Updater.h
    QML_FILES
        qml/Main.qml
        qml/Theme.qml
        qml/AppState.qml
        qml/Icons.qml
        qml/Fmt.js

        qml/controls/Field.qml
        qml/controls/Icon.qml
        qml/controls/IconButton.qml
        qml/controls/Kbd.qml
        qml/controls/Caret.qml
        qml/controls/MenuRow.qml
        qml/controls/ModalDialog.qml
        qml/controls/PopupMenu.qml
        qml/controls/MenuBase.qml
        qml/controls/ResizeFrame.qml
        qml/controls/WindowButtons.qml
        qml/controls/DragArea.qml
        qml/controls/ScrollBarThin.qml
        qml/controls/TextButton.qml
        qml/controls/Tip.qml
        qml/controls/Toggle.qml
        qml/controls/Shadow.qml
        qml/controls/Checkbox.qml
        qml/controls/Segmented.qml
        qml/controls/SectionLabel.qml
        qml/controls/SettingRow.qml
        qml/controls/PageColumns.qml
        qml/controls/Picker.qml
        qml/controls/Tabs.qml

        qml/panels/MiniCalendar.qml
        qml/panels/Header.qml
        qml/panels/TabStrip.qml
        qml/panels/SideTask.qml
        qml/panels/FolderCard.qml
        qml/panels/SheetPreview.qml
        qml/panels/Sidebar.qml
        qml/panels/PopoutManager.qml
        qml/panels/PopoutWindow.qml

        qml/editor/EditorPane.qml
        qml/editor/FindBar.qml
        qml/editor/NoteHeader.qml
        qml/editor/PlainEditor.qml
        qml/editor/RichEditor.qml
        qml/editor/LockPanel.qml
        qml/editor/SelectionToolbar.qml
        qml/editor/MovePicker.qml
        qml/editor/TagPicker.qml
        qml/editor/DuePicker.qml
        qml/editor/SlashMenu.qml

        qml/pages/DeskPage.qml
        qml/pages/ListPage.qml
        qml/pages/TodosPage.qml
        qml/pages/SearchPage.qml
        qml/pages/SettingsPage.qml
        qml/pages/TrashPage.qml

        qml/dialogs/QuickFind.qml
        qml/dialogs/PinDialog.qml
        qml/dialogs/QuickCapture.qml
        qml/dialogs/SyncSetupDialog.qml
        qml/dialogs/ShareListDialog.qml
        qml/dialogs/JoinListDialog.qml
)

qt_add_resources(noted "noted_assets"
    PREFIX "/"
    BASE resources
    FILES
        resources/fonts/Geist-Variable.ttf
        resources/fonts/GeistMono-Variable.ttf
        resources/fonts/lucide.ttf
        resources/brand/icon.png
        resources/brand/noted-logo.svg
        resources/brand/noted-icon.svg
)

target_include_directories(noted PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)

target_link_libraries(noted PRIVATE
    Noted::Core
    Qt6::Gui
    Qt6::GuiPrivate
    Qt6::Qml
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::Network
    Qt6::Svg
)
if(WIN32)
    target_link_libraries(noted PRIVATE ole32)  # the system spell checker (COM)
endif()

set_target_properties(noted PROPERTIES
    OUTPUT_NAME noted
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}
    MACOSX_BUNDLE_GUI_IDENTIFIER com.voyagertech.noted
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION}
)

install(TARGETS noted BUNDLE DESTINATION . RUNTIME DESTINATION bin)
