@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.nback

import android.content.Context
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

private val Blue = Color(0xff4169e1)
private enum class Tab(val title: String) { PLAY("Play"), HELP("Help"), STATS("Stats"), SETTINGS("Settings") }

@Composable
fun NBackApp(model: AppViewModel) {
    val settings by model.settings.collectAsState()
    val records by model.records.collectAsState()
    val game by model.game.collectAsState()
    MaterialTheme(colorScheme = lightColorScheme(primary = Blue, secondary = Color(0xff00a6a6))) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surfaceContainerLowest) {
            if (game != null) GameScreen(model, settings, requireNotNull(game))
            else Home(model, settings, records)
        }
    }
}

@Composable
private fun Home(model: AppViewModel, settings: GameSettings, records: List<GameRecord>) {
    var tab by rememberSaveable { mutableStateOf(Tab.PLAY) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { item ->
                    NavigationBarItem(tab == item, { tab = item }, icon = {
                        Icon(when (item) { Tab.PLAY -> Icons.Default.PlayCircle; Tab.HELP -> Icons.Default.Help; Tab.STATS -> Icons.Default.BarChart; Tab.SETTINGS -> Icons.Default.Settings }, null)
                    }, label = { Text(item.title) })
                }
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                Tab.PLAY -> PlayScreen(settings) { model.startGame() }
                Tab.HELP -> HelpScreen()
                Tab.STATS -> StatsScreen(settings, records, model::clearRecords)
                Tab.SETTINGS -> SettingsScreen(settings, model)
            }
        }
    }
}

@Composable
private fun Page(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Spacer(Modifier.height(10.dp)); Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); content(); Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun PlayScreen(s: GameSettings, start: () -> Unit) = Page("N-Back Training") {
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("${s.currentLevel}-Back", fontSize = 38.sp, fontWeight = FontWeight.Bold, color = Blue)
        Text("${s.gridSize} × ${s.gridSize} grid · ${s.gameTrials} trials · ${s.trialDelayMillis / 1000.0}s")
        Text(s.enabledModalities.joinToString(" + ") { it.name.lowercase().replaceFirstChar(Char::uppercase) })
    } }
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(20.dp)) {
        Text("Level progression", fontWeight = FontWeight.Bold)
        Text("Level up after ${s.consecutiveWinsForLevelUp} consecutive wins")
        Text("Level down after ${s.consecutiveLossesForLevelDown} consecutive losses")
        Text("Progress resets when you return to the menu", style = MaterialTheme.typography.bodySmall)
    } }
    Button(start, Modifier.fillMaxWidth().height(56.dp)) { Icon(Icons.Default.PlayArrow, null); Spacer(Modifier.width(8.dp)); Text("Start game") }
}

@Composable
private fun HelpScreen() = Page("How to play") {
    HelpCard("The N-Back task", "Remember each stimulus and respond when it matches the stimulus shown N trials earlier.")
    HelpCard("Modalities", "Position uses the grid, Audio uses spoken letters, Color uses the stimulus color, and Shape uses its shape. Enable any combination in Settings.")
    HelpCard("Respond", "Tap each matching modality during the current trial. You can select several modalities, but each can only be selected once. Do nothing when there is no match.")
    HelpCard("Tip", "Start at 1-Back or 2-Back with one or two modalities, then increase difficulty as the pattern becomes comfortable.")
}

@Composable private fun HelpCard(title: String, body: String) = ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp)) { Text(title, fontWeight = FontWeight.Bold); Spacer(Modifier.height(6.dp)); Text(body) } }

@Composable
private fun SettingsScreen(s: GameSettings, model: AppViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var importText by remember { mutableStateOf("") }
    var showImport by remember { mutableStateOf(false) }
    val create = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) scope.launch { runCatching { context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { it.write(model.exportData()) } ?: error("Unable to open file") }.notify(context, "Backup exported", "Export failed") }
    }
    val open = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch { runCatching { context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: error("Unable to read file") }.onSuccess { text -> runCatching { model.importData(text) }.notify(context, "Backup imported", "Import failed") } }
    }
    Page("Settings") {
        StepSetting("Current level", "${s.currentLevel}-Back", { model.updateSettings(s.copy(currentLevel = s.currentLevel - 1)) }, { model.updateSettings(s.copy(currentLevel = s.currentLevel + 1)) })
        StepSetting("Grid size", "${s.gridSize} × ${s.gridSize}", { model.updateSettings(s.copy(gridSize = s.gridSize - 1)) }, { model.updateSettings(s.copy(gridSize = s.gridSize + 1)) })
        StepSetting("Trial duration", "${s.trialDelayMillis / 1000.0}s", { model.updateSettings(s.copy(trialDelayMillis = s.trialDelayMillis - 500)) }, { model.updateSettings(s.copy(trialDelayMillis = s.trialDelayMillis + 500)) })
        StepSetting("Scored trials", "${s.gameTrials}", { model.updateSettings(s.copy(gameTrials = s.gameTrials - 1)) }, { model.updateSettings(s.copy(gameTrials = s.gameTrials + 1)) })
        StepSetting("Match probability", "${(s.matchProbability * 100).toInt()}%", { model.updateSettings(s.copy(matchProbability = s.matchProbability - .1)) }, { model.updateSettings(s.copy(matchProbability = s.matchProbability + .1)) })
        StepSetting("Win threshold", "${s.winThreshold}%", { model.updateSettings(s.copy(winThreshold = s.winThreshold - 5)) }, { model.updateSettings(s.copy(winThreshold = s.winThreshold + 5)) })
        StepSetting("Loss threshold", "${s.lossThreshold}%", { model.updateSettings(s.copy(lossThreshold = s.lossThreshold - 5)) }, { model.updateSettings(s.copy(lossThreshold = s.lossThreshold + 5)) })
        StepSetting("Wins to level up", "${s.consecutiveWinsForLevelUp}", { model.updateSettings(s.copy(consecutiveWinsForLevelUp = s.consecutiveWinsForLevelUp - 1)) }, { model.updateSettings(s.copy(consecutiveWinsForLevelUp = s.consecutiveWinsForLevelUp + 1)) })
        StepSetting("Losses to level down", "${s.consecutiveLossesForLevelDown}", { model.updateSettings(s.copy(consecutiveLossesForLevelDown = s.consecutiveLossesForLevelDown - 1)) }, { model.updateSettings(s.copy(consecutiveLossesForLevelDown = s.consecutiveLossesForLevelDown + 1)) })
        Text("Modalities", style = MaterialTheme.typography.titleLarge)
        Modality.entries.forEach { modality ->
            val checked = modality in s.enabledModalities
            ListItem(headlineContent = { Text(modality.name.lowercase().replaceFirstChar(Char::uppercase)) }, trailingContent = {
                Switch(checked, { on -> val set = if (on) s.enabledModalities + modality else s.enabledModalities - modality; if (set.isNotEmpty()) model.updateSettings(s.copy(enabledModalities = set)) else Toast.makeText(context, "At least one modality is required", Toast.LENGTH_SHORT).show() })
            })
        }
        OutlinedButton({ model.updateSettings(GameSettings()) }, Modifier.fillMaxWidth()) { Text("Reset to defaults") }
        Text("Backup & restore", style = MaterialTheme.typography.titleLarge)
        Button({ create.launch("nback-backup.json") }, Modifier.fillMaxWidth()) { Icon(Icons.Default.Upload, null); Text(" Export backup") }
        OutlinedButton({ open.launch(arrayOf("application/json", "text/plain")) }, Modifier.fillMaxWidth()) { Icon(Icons.Default.Download, null); Text(" Import backup file") }
        TextButton({ showImport = true }, Modifier.fillMaxWidth()) { Text("Paste legacy backup text") }
    }
    if (showImport) AlertDialog({ showImport = false }, title = { Text("Import backup") }, text = { OutlinedTextField(importText, { importText = it }, Modifier.fillMaxWidth().height(220.dp), label = { Text("Backup JSON or shared text") }) }, confirmButton = { TextButton({ scope.launch { runCatching { model.importData(importText) }.notify(context, "Backup imported", "Invalid backup"); showImport = false } }) { Text("Import") } }, dismissButton = { TextButton({ showImport = false }) { Text("Cancel") } })
}

private fun Result<*>.notify(context: Context, success: String, failure: String) { Toast.makeText(context, if (isSuccess) success else "$failure: ${exceptionOrNull()?.message}", Toast.LENGTH_LONG).show() }

@Composable private fun StepSetting(label: String, value: String, minus: () -> Unit, plus: () -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth()) { Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(label, fontWeight = FontWeight.Medium); Text(value, color = Blue) }
        FilledTonalIconButton(minus) { Icon(Icons.Default.Remove, null) }; Spacer(Modifier.width(8.dp)); FilledTonalIconButton(plus) { Icon(Icons.Default.Add, null) }
    } }
}

@Composable
private fun StatsScreen(settings: GameSettings, records: List<GameRecord>, clear: () -> Unit) {
    val filtered = records.filter { it.enabledModalities == settings.enabledModalities }
    var sevenDays by remember { mutableStateOf(false) }
    var confirmClear by remember { mutableStateOf(false) }
    val shown = if (!sevenDays) filtered else filtered.filter { parseDate(it.date) >= System.currentTimeMillis() - 7 * 86_400_000L }
    Page("Your progress") {
        Text(settings.enabledModalities.joinToString(" + ") { it.name.lowercase().replaceFirstChar(Char::uppercase) } + " mode", color = Blue)
        if (filtered.isEmpty()) Text("No games played with these modalities yet.") else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Games", filtered.size.toString(), Modifier.weight(1f)); StatCard("Highest", filtered.maxOf { it.difficulty }.toString(), Modifier.weight(1f)); StatCard("Average", "%.1f%%".format(filtered.map { it.accuracy }.average()), Modifier.weight(1f))
            }
            FilterChip(sevenDays, { sevenDays = !sevenDays }, { Text(if (sevenDays) "Last 7 days" else "All time") })
            if (shown.isNotEmpty()) {
                ChartCard("Difficulty over time", shown.map { it.difficulty.toFloat() }, 1f, (shown.maxOf { it.difficulty } + 1).toFloat())
                ChartCard("Accuracy over time", shown.map { it.accuracy.toFloat() }, 0f, 100f)
            }
            Text("Recent games", style = MaterialTheme.typography.titleLarge)
            filtered.takeLast(10).asReversed().forEach { record ->
                ElevatedCard(Modifier.fillMaxWidth()) { Row(Modifier.padding(16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(displayDate(record.date)); Text("${record.difficulty}-Back · %.1f%%".format(record.accuracy)) }
                    Text(when (record.outcome) { Outcome.WIN -> "🏆 Win"; Outcome.LOSS -> "Loss"; Outcome.NEUTRAL -> "Neutral" }, fontWeight = FontWeight.Bold)
                } }
            }
            TextButton({ confirmClear = true }, Modifier.fillMaxWidth()) { Text("Clear all statistics", color = MaterialTheme.colorScheme.error) }
        }
    }
    if (confirmClear) AlertDialog({ confirmClear = false }, title = { Text("Clear statistics?") }, text = { Text("This cannot be undone unless you exported a backup.") }, confirmButton = { TextButton({ clear(); confirmClear = false }) { Text("Clear") } }, dismissButton = { TextButton({ confirmClear = false }) { Text("Cancel") } })
}

@Composable private fun StatCard(label: String, value: String, modifier: Modifier) = ElevatedCard(modifier) { Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(value, fontWeight = FontWeight.Bold, color = Blue); Text(label, style = MaterialTheme.typography.labelSmall) } }

@Composable private fun ChartCard(title: String, values: List<Float>, min: Float, max: Float) = ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
    Text(title, fontWeight = FontWeight.Bold); Spacer(Modifier.height(12.dp)); Canvas(Modifier.fillMaxWidth().height(180.dp)) {
        if (values.size == 1) drawCircle(Blue, 5.dp.toPx(), Offset(size.width / 2, size.height - (values[0] - min) / (max - min) * size.height))
        else { val path = Path(); values.forEachIndexed { i, v -> val point = Offset(i * size.width / (values.size - 1), size.height - (v - min) / (max - min) * size.height); if (i == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y); drawCircle(Blue, 3.dp.toPx(), point) }; drawPath(path, Blue, style = Stroke(3.dp.toPx())) }
    }
} }

@Composable
private fun GameScreen(model: AppViewModel, settings: GameSettings, state: GameUiState) {
    val context = LocalContext.current
    val player = remember { LetterPlayer(context) }
    DisposableEffect(Unit) { onDispose(player::release) }
    LaunchedEffect(state.audioToken) { if (state.phase == GamePhase.PLAYING) player.play(state.stimulus?.letter) }
    BackHandler { model.exitGame() }
    when (state.phase) {
        GamePhase.COUNTDOWN -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("Get ready", style = MaterialTheme.typography.headlineMedium); Text(state.countdown.toString(), fontSize = 72.sp, fontWeight = FontWeight.Bold, color = Blue) } }
        GamePhase.PAUSED -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Paused", style = MaterialTheme.typography.headlineLarge) }
        GamePhase.FINISHED -> ResultsScreen(state, settings, model::exitGame, model::playAgain)
        GamePhase.PLAYING -> PlayingScreen(state, settings, model::respond, model::exitGame)
    }
}

@Composable
private fun PlayingScreen(state: GameUiState, s: GameSettings, respond: (Modality) -> Unit, exit: () -> Unit) {
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { IconButton(exit) { Icon(Icons.Default.Close, "Exit") }; Spacer(Modifier.weight(1f)); Text(if (state.warmup) "Warm-up ${state.stimulus?.number}/${s.currentLevel}" else "Trial ${state.scoredTrial}/${s.gameTrials}", fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Spacer(Modifier.width(48.dp)) }
        Spacer(Modifier.weight(1f)); StimulusGrid(state.stimulus, s); Spacer(Modifier.weight(1f))
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            s.enabledModalities.forEach { modality -> Button({ respond(modality) }, enabled = !state.warmup && modality !in state.pressed, modifier = Modifier.weight(1f)) { Text(modality.name.lowercase().replaceFirstChar(Char::uppercase)) } }
        }
    }
}

@Composable
private fun StimulusGrid(stimulus: Stimulus?, s: GameSettings) {
    val grid = if (Modality.POSITION in s.enabledModalities) s.gridSize else 1
    BoxWithConstraints(Modifier.fillMaxWidth().widthIn(max = 360.dp).aspectRatio(1f).border(2.dp, Color.DarkGray)) {
        val cell = maxWidth / grid
        for (i in 0 until grid * grid) Box(Modifier.offset(cell * (i % grid), cell * (i / grid)).size(cell).border(0.5.dp, Color.Gray))
        stimulus?.let { st ->
            val pos = st.position ?: 0
            Box(Modifier.offset(cell * (pos % grid), cell * (pos / grid)).size(cell).padding(8.dp), contentAlignment = Alignment.Center) {
                Shape(st.shape, Color(st.color ?: 0xff4169e1.toInt()), cell * .72f)
            }
        }
    }
}

@Composable private fun Shape(shape: String?, color: Color, size: androidx.compose.ui.unit.Dp) {
    Canvas(Modifier.size(size).then(if (shape == "diamond") Modifier.rotate(45f) else Modifier)) {
        when (shape) {
            "circle" -> drawCircle(color)
            "triangle" -> drawPath(Path().apply { moveTo(this@Canvas.size.width / 2, 0f); lineTo(this@Canvas.size.width, this@Canvas.size.height); lineTo(0f, this@Canvas.size.height); close() }, color)
            else -> drawRect(color)
        }
    }
}

@Composable
private fun ResultsScreen(state: GameUiState, s: GameSettings, exit: () -> Unit, again: () -> Unit) {
    var details by remember { mutableStateOf(false) }
    val score = requireNotNull(state.result)
    Page("Game over") {
        ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(24.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(when (state.outcome) { Outcome.WIN -> "🏆 You win!"; Outcome.LOSS -> "You lose"; else -> "Neutral" }, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("%.1f%% accuracy".format(score.accuracy), fontSize = 28.sp, color = Blue)
            Text("Win ${s.winThreshold}% · Loss ${s.lossThreshold}%")
            if (state.levelChange != 0) Text(if (state.levelChange > 0) "Level up to ${state.nextLevel}-Back" else "Level down to ${state.nextLevel}-Back", fontWeight = FontWeight.Bold)
        } }
        ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text("Session", fontWeight = FontWeight.Bold); Text("Wins ${state.session.wins} · Losses ${state.session.losses} · Neutral ${state.session.neutrals}") } }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedButton(exit, Modifier.weight(1f)) { Text("Menu") }; Button(again, Modifier.weight(1f)) { Text("Play again") } }
        TextButton({ details = !details }, Modifier.fillMaxWidth()) { Text(if (details) "Hide detailed statistics" else "Show detailed statistics") }
        AnimatedVisibility(details) { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { score.matrices.forEach { (m, v) -> ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text(m.name.lowercase().replaceFirstChar(Char::uppercase), fontWeight = FontWeight.Bold); Text("TP ${v.tp} · FP ${v.fp} · TN ${v.tn} · FN ${v.fn}"); Text("Accuracy %.0f%% · Sensitivity %.0f%% · Specificity %.0f%%".format(v.accuracy, v.sensitivity, v.specificity)) } } } } }
    }
}

private fun parseDate(value: String): Long = runCatching { SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(value)?.time ?: 0 }.getOrDefault(0)
private fun displayDate(value: String): String = SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(parseDate(value)))
