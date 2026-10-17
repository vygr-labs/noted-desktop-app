# noted-core
#
# Everything that is not UI: SQLite storage (schema shared with the Electron
# build and noted-cli), the TipTap <-> QTextDocument document model, export
# converters, and the Q_OBJECT services QML binds to. Links Qt Gui for
# QTextDocument/QPdfWriter but never Qt Quick.

add_library(noted-core STATIC
    src/third_party/sqlite3.c
    src/db/Sqlite.cpp
    include/noted/Sqlite.h

    src/Database.cpp
    src/NoteStore.cpp
    src/NotesModel.cpp
    src/PinHasher.cpp
    src/DateText.cpp

    src/doc/TipTap.cpp
    src/doc/Export.cpp
    src/doc/Styler.cpp

    include/noted/Database.h
    include/noted/NoteStore.h
    include/noted/NotesModel.h
    include/noted/PinHasher.h
    include/noted/DateText.h
    include/noted/doc/Schema.h
    include/noted/doc/TipTap.h
    include/noted/doc/Export.h
    include/noted/doc/Styler.h
)

target_include_directories(noted-core
    PUBLIC  ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/src/third_party
)

target_link_libraries(noted-core
    PUBLIC Qt6::Core Qt6::Gui Qt6::Qml Qt6::Concurrent
)

target_compile_definitions(noted-core
    PUBLIC NOTED_VERSION_STRING="${PROJECT_VERSION}"
    PRIVATE
        SQLITE_ENABLE_FTS5
        SQLITE_THREADSAFE=2
        SQLITE_DQS=0
        SQLITE_DEFAULT_MEMSTATUS=0
        SQLITE_OMIT_DEPRECATED
        SQLITE_OMIT_LOAD_EXTENSION
        SQLITE_LIKE_DOESNT_MATCH_BLOBS
)

if(MSVC)
    set_source_files_properties(src/third_party/sqlite3.c PROPERTIES COMPILE_OPTIONS "/W0")
else()
    set_source_files_properties(src/third_party/sqlite3.c PROPERTIES COMPILE_OPTIONS "-w")
endif()

add_library(Noted::Core ALIAS noted-core)
